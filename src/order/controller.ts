import express from "express";
import { Order } from "./schema";
import { Status } from '../_global/enums'

export const createOrder = async (req: express.Request, res: express.Response): Promise<void> => {
    try {
        const order = { ...req.body, status: Status.Active }
        const createdOrder = await new Order(order).save()
        res.status(200).send(createdOrder);
    } catch (error) {
        console.error("Error creating order:", error);
        res.status(500).json({ message: "Server error" });
    }
};

export const updateOrder = async (req: express.Request, res: express.Response): Promise<void> => {
    try {
        const { orderId } = req.params;
    
        const updatedOrder = await Order.findByIdAndUpdate(
          orderId, 
          req.body, 
          { new: true, runValidators: true } 
        );
    
        if (!updatedOrder) {
          res.status(404).json({ message: "Order not found" });
          return;
        }

        res.status(200).json(updatedOrder);
      } catch (error) {
        console.error("Error updating order:", error);
        res.status(500).json({ message: "Server error" });
      }
};

export const getOrder = async (req: express.Request, res: express.Response): Promise<void> => {
    try {
        const { orderId } = req.params;
    
        const order = await Order.findById(orderId);
    
        if (!order) {
          res.status(404).json({ message: "Order not found" });
          return;
        }

        res.status(200).json(order);
      } catch (error) {
        console.error("Error fetching order:", error);
        res.status(500).json({ message: "Server error" });
      }
};

export const deleteOrder = async (req: express.Request, res: express.Response): Promise<void> => {
    try {
        const { orderId } = req.params;
    
        const updatedOrder = await Order.findByIdAndUpdate(
            orderId, 
            { status: Status.Archived }, 
            { new: true, runValidators: true } 
          );
      
          if (!updatedOrder) {
            res.status(404).json({ message: "Order not found" });
            return;
          }

        res.status(200).json(updatedOrder);
      } catch (error) {
        console.error("Error deleting order:", error);
        res.status(500).json({ message: "Server error" });
      }
};

export const getOrders = async (req: express.Request, res: express.Response): Promise<void> => {
    try {

        const { portalId, role } = req.query;
        let filter: any = { status: Status.Active};

        if (portalId) {
            filter.portalId = portalId;
        }

        if (role) {
            filter.role = role;
        }
   
        const orders = await Order.find(filter);
      
        res.status(200).json(orders);

      } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).json({ message: "Server error" });
      }
};
