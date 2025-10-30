import { Injectable } from '@nestjs/common';
import { envs } from 'src/config';
import Stripe from 'stripe';
import { PaymentSessionDto } from './dto';
import type { Request, Response } from 'express';

@Injectable()
export class PaymentsService {
  private readonly stripe = new Stripe(envs.stripeSecret);

  async createPaymentSession(paymentSessionDto: PaymentSessionDto) {
    const { currency, items, orderId } = paymentSessionDto;

    const lineItems = items.map((item) => {
      return {
        price_data: {
          currency,
          product_data: {
            name: item.name,
          },
          unit_amount:  Math.round(item.price*100),
        },
        quantity: item.quantity,
      };
    });

    const session = await this.stripe.checkout.sessions.create({
      payment_intent_data: {
        metadata: {
          orderId
        },
      },
      line_items: lineItems,
      mode: 'payment',
      success_url: envs.stripeSuccessUrl,
      cancel_url: envs.stripeCancelUrl,
    });

    return session;
  }

  async stripeWebhook( req: Request, res: Response ) {
    const signature = req.headers['stripe-signature'];

    if (typeof signature !== 'string') {
      return res.status(400).send('Missing or invalid Stripe signature');
    }

    let event: Stripe.Event;
    const endpointSecret = envs.stripeEndpointSecret;

    try {
      event = this.stripe.webhooks.constructEvent(req['rawBody'], signature, endpointSecret);
    } catch (error) {
      res.status(400).send(`Webhook Error: ${error.message}`);
      return;
    }

    console.log(event);

    switch( event.type ){
      case 'charge.succeeded':
        // Llamar microservicio
        const chargeSucceeded = event.data.object;
        console.log({
          metadata: chargeSucceeded.metadata
        })
        break;
      default : 
      console.log(`Event ${ event.type } not handled`)
    }

    return res.status(200).json({signature});
  }

}
