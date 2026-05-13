import Stripe from "stripe";

// Initialize Stripe with the secret key from the environment
if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("Missing STRIPE_SECRET_KEY environment variable. Payment links will not work in production.");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_mock", {
  apiVersion: "2026-04-22.dahlia",
});

export async function createPaymentLinkForInvoice(
  invoiceId: string,
  amountCents: number,
  title: string,
  clientEmail: string
) {
  if (!process.env.STRIPE_SECRET_KEY) {
    // Return mock data for local dev without Stripe
    return {
      paymentLinkId: `plink_mock_${invoiceId}`,
      url: `https://stripe.com/mock-payment/${invoiceId}`
    };
  }

  try {
    // Create a product/price on the fly for this specific invoice
    // Alternatively, you could use a fixed product and just pass custom amount via Price data
    const price = await stripe.prices.create({
      currency: "usd",
      unit_amount: amountCents,
      product_data: {
        name: title,
        metadata: { invoiceId }
      },
    });

    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      customer_creation: "always",
      metadata: { invoiceId },
      after_completion: {
        type: "redirect",
        redirect: {
          url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/booking/payment-success?invoice_id=${invoiceId}`
        }
      }
    });

    return {
      paymentLinkId: paymentLink.id,
      url: paymentLink.url
    };
  } catch (error) {
    console.error("Stripe createPaymentLink error:", error);
    throw new Error("Failed to create Stripe payment link");
  }
}
