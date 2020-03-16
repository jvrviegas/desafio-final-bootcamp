import * as Yup from 'yup';
import Order from '../models/Order';
import Recipient from '../models/Recipient';
import Deliveryman from '../models/Deliveryman';

import NewOrderMail from '../jobs/NewOrderMail';
import Queue from '../../lib/Queue';

class OrderController {
  async index(req, res) {
    const orders = await Order.findAll({
      attributes: ['id', 'product', 'createdAt'],
      order: [['created_at', 'desc']],
      include: [
        {
          model: Recipient,
          as: 'recipient',
          attributes: ['id', 'name'],
        },
        {
          model: Deliveryman,
          as: 'deliveryman',
          attributes: ['id', 'name', 'email'],
        },
      ],
    });

    if (!orders) {
      return res.status(500).json({ error: 'Internal server error' });
    }

    return res.json(orders);
  }

  async show(req, res) {
    const order = await Order.findByPk(req.params.id, {
      include: [
        {
          model: Recipient,
          as: 'recipient',
          attributes: ['id', 'name'],
        },
        {
          model: Deliveryman,
          as: 'deliveryman',
          attributes: ['id', 'name', 'email'],
        },
      ],
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    return res.json(order);
  }

  async store(req, res) {
    const schema = Yup.object().shape({
      recipient_id: Yup.number().required(),
      deliveryman_id: Yup.number().required(),
      signature_id: Yup.number(),
      product: Yup.string().required(),
    });

    if (!(await schema.isValid(req.body))) {
      return res.status(400).json({ error: 'Validation fails' });
    }

    const recipient = await Recipient.findByPk(req.body.recipient_id);

    if (!recipient) {
      return res.status(400).json({ error: 'Unable to find recipient' });
    }

    const deliveryman = await Deliveryman.findByPk(req.body.deliveryman_id);

    if (!deliveryman) {
      return res.status(400).json({ error: 'Unable to find deliveryman' });
    }

    const order = await Order.create(req.body);

    if (!order) {
      return res.status(500).json({
        error: 'Fail to create the order, try again in a few seconds',
      });
    }

    await Queue.add(NewOrderMail.key, {
      deliveryman,
      order,
    });

    return res.status(201).json(order);
  }

  async update(req, res) {
    const schema = Yup.object().shape({
      recipient_id: Yup.number(),
      deliveryman_id: Yup.number(),
      product: Yup.string(),
    });

    if (!(await schema.isValid(req.body))) {
      return res.status(400).json({ error: 'Validation fails.' });
    }

    const { deliveryman_id, recipient_id } = req.body;

    if (!(await Deliveryman.findByPk(deliveryman_id))) {
      return res.status(404).json({ error: 'Delivery man not found' });
    }

    if (!(await Recipient.findByPk(recipient_id))) {
      return res.status(404).json({ error: 'Recipient man not found' });
    }

    const order = await Order.findByPk(req.params.id);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    order.update(req.body);

    return res.json();
  }

  async delete(req, res) {
    const order = await Order.findByPk(req.params.id, {
      include: [
        {
          model: Recipient,
          as: 'recipient',
          attributes: ['id', 'name'],
        },
        {
          model: Deliveryman,
          as: 'deliveryman',
          attributes: ['id', 'name', 'email'],
        },
      ],
    });

    if (order.start_date !== null) {
      return res
        .status(401)
        .json({ error: 'You cannot cancel a delivery in progress.' });
    }

    order.canceled_at = new Date();

    await order.save();

    return res.json(order);
  }
}

export default new OrderController();
