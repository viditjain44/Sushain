import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public"));

const store = process.env.SHOPIFY_STORE;
const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
const apiVersion = process.env.SHOPIFY_API_VERSION || "2026-07";

async function shopifyGraphQL(query, variables = {}) {
  if (!store || !accessToken) {
    throw new Error("SHOPIFY_STORE or SHOPIFY_ACCESS_TOKEN is missing in .env");
  }

  const response = await fetch(
    `https://${store}/admin/api/${apiVersion}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken
      },
      body: JSON.stringify({ query, variables })
    }
  );

  const data = await response.json();

  if (!response.ok || data.errors) {
    throw new Error(
      data.errors?.map((e) => e.message).join(", ") ||
      `Shopify API error: ${response.status}`
    );
  }

  return data;
}

app.get("/api/orders", async (req, res) => {
  try {
    const { email, status, limit = 20 } = req.query;

    const filters = [];

    if (email?.trim()) {
      filters.push(`email:${email.trim()}`);
    }

    if (status && status !== "all") {
      filters.push(`financial_status:${status}`);
    }

    const queryString = filters.join(" ");
    const first = Math.min(Math.max(Number(limit) || 20, 1), 100);

    const query = `
      query GetOrders($first: Int!, $query: String) {
        orders(first: $first, query: $query, sortKey: CREATED_AT, reverse: true) {
          edges {
            cursor
            node {
              id
              name
              createdAt
              displayFinancialStatus
              displayFulfillmentStatus
              email
              phone
              currentTotalPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              customer {
                firstName
                lastName
                email
              }
              lineItems(first: 20) {
                edges {
                  node {
                    title
                    quantity
                    sku
                    originalUnitPriceSet {
                      shopMoney {
                        amount
                        currencyCode
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const result = await shopifyGraphQL(query, {
      first,
      query: queryString || null
    });

    const orders = result.data.orders.edges.map(({ node }) => ({
      id: node.id,
      orderNumber: node.name,
      createdAt: node.createdAt,
      financialStatus: node.displayFinancialStatus,
      fulfillmentStatus: node.displayFulfillmentStatus,
      email: node.email || node.customer?.email || "",
      phone: node.phone || "",
      customerName: [node.customer?.firstName, node.customer?.lastName]
        .filter(Boolean)
        .join(" "),
      total: node.currentTotalPriceSet.shopMoney.amount,
      currency: node.currentTotalPriceSet.shopMoney.currencyCode,
      items: node.lineItems.edges.map(({ node: item }) => ({
        title: item.title,
        quantity: item.quantity,
        sku: item.sku,
        price: item.originalUnitPriceSet.shopMoney.amount
      }))
    }));

    res.json({ success: true, orders });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});