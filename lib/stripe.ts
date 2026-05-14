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

/**
 * Phase 4.13 — Digital products store.
 * Creates a one-off Stripe Price + Payment Link for a digital product.
 * The webhook routes by `metadata.productId` to deliver the file.
 */
export async function createProductPaymentLink(opts: {
  productId: string;
  productTitle: string;
  amountCents: number;
}): Promise<{
  paymentLinkUrl: string;
  paymentLinkId: string;
  priceId: string;
}> {
  if (!process.env.STRIPE_SECRET_KEY) {
    return {
      paymentLinkUrl: `https://example.com/mock-product-link/${opts.productId}`,
      paymentLinkId: `plink_mock_${opts.productId}`,
      priceId: `price_mock_${opts.productId}`,
    };
  }

  try {
    const price = await stripe.prices.create({
      currency: "usd",
      unit_amount: opts.amountCents,
      product_data: {
        name: opts.productTitle,
        metadata: { productId: opts.productId },
      },
    });

    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      // We need the customer's email to deliver the file by email.
      customer_creation: "always",
      metadata: { productId: opts.productId },
      after_completion: {
        type: "redirect",
        redirect: {
          url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/shop/thank-you?product_id=${opts.productId}`,
        },
      },
    });

    return {
      paymentLinkUrl: paymentLink.url,
      paymentLinkId: paymentLink.id,
      priceId: price.id,
    };
  } catch (error) {
    console.error("Stripe createProductPaymentLink error:", error);
    throw new Error("Failed to create Stripe product payment link");
  }
}
