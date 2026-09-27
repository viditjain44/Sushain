This is a small Node.js and Express app that fetches orders from Shopify using the Shopify Admin API without requiring an Order ID.

To use it, install the dependencies with `npm install`, add your Shopify store URL and Admin API access token to the `.env` file, and run the app using `npm start`.

The app can fetch orders using details like customer email, payment status, date, or other filters.

The access token is kept on the backend and is not exposed to the frontend.