import axios from "axios";

export async function createPaymobPayment({
  amount,
  orderId,
  customer,
}) {

  const response = await axios.post(
    "https://accept.paymob.com/v1/intention/",
    {
      amount: Math.round(amount * 100),
      currency: "EGP",

      payment_methods: [
        Number(process.env.PAYMOB_INTEGRATION_ID)
      ],

      items: [],

      billing_data: {
        first_name: (customer.name || "Customer").split(" ")[0],
        last_name: (customer.name || "Customer").split(" ").slice(1).join(" ") || "N/A",
        phone_number: customer.phone || "01000000000",
        email: customer.email || "customer@example.com",
        street: customer.address || "N/A",
        city: customer.city || "N/A",
        country: customer.country || "EG",
        state: "N/A",
        building: "N/A",
        floor: "N/A",
        apartment: "N/A",
        postal_code: "N/A",
      },
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.PAYMOB_SECRET_KEY}`,
      },
    }
  );

  const clientSecret = response.data.client_secret;
  const paymobOrderId = response.data.intention_order_id;
  const checkoutUrl = `https://accept.paymob.com/unifiedcheckout/?publicKey=${process.env.PAYMOB_PUBLIC_KEY}&clientSecret=${clientSecret}`;

  return {
    checkoutUrl,
    paymobOrderId,
  };
}

export async function getPaymobTransaction(transactionId) {
  try {
    console.log(`[Paymob Service] Verifying transaction ${transactionId} using Secret Key...`);
    const response = await axios.get(
      `https://accept.paymob.com/api/acceptance/transactions/${transactionId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYMOB_SECRET_KEY || process.env.PAYMOB_API_KEY}`,
        },
      }
    );
    return response.data;
  } catch (error) {
    console.warn(`[Paymob Service] Secret Key auth failed or not supported, trying classic auth token...`, error.message);
    const authResponse = await axios.post("https://accept.paymob.com/api/auth/tokens", {
      api_key: process.env.PAYMOB_API_KEY || process.env.PAYMOB_SECRET_KEY
    });
    const token = authResponse.data.token;
    const response = await axios.get(
      `https://accept.paymob.com/api/acceptance/transactions/${transactionId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data;
  }
}