import express from "express";
import { Quote } from "./schema";
import { Status } from '../_global/enums'
import { calculateMiles } from "./services/calculateMiles";
import { calculateVehiclePricing } from "./services/calculateVehiclePricing";
import { calculateTotalPricing } from "./services/calculateTotalPricing";
import { validateLocation } from "./util";

export const createQuote = async (req: express.Request, res: express.Response): Promise<void> => {
    try {
        const { portalId, userId, customer, origin, destination, transportType, vehicles } = req.body;
        const originValidated = validateLocation(origin);
        const destinationValidated = validateLocation(destination);
        const miles = calculateMiles(originValidated, destinationValidated);
        const vehicleQuotes = await calculateVehiclePricing(vehicles);
        const totalPricing = await calculateTotalPricing(vehicleQuotes);

        const formattedQuote =  {
          status: Status.Active,
          portalId,
          userId,
          customer,
          origin,
          originValidated: validateLocation(origin),
          destination,
          destinationValidated: validateLocation(destination),
          miles,
          transportType,
          vehicles: vehicleQuotes, 
          totalPricing
        }

        const createdQuote = await new Quote(formattedQuote).save()
        res.status(200).send(createdQuote);
    } catch (error) {
        console.error("Error creating quote:", error);
        res.status(500).json({ message: "Server error" });
    }
};

export const updateQuote = async (req: express.Request, res: express.Response): Promise<void> => {
    try {
        const { quoteId } = req.params;
    
        const updatedQuote = await Quote.findByIdAndUpdate(
          quoteId, 
          req.body, 
          { new: true, runValidators: true } 
        );
    
        if (!updatedQuote) {
          res.status(404).json({ message: "Quote not found" });
          return;
        }

        res.status(200).json(updatedQuote);
      } catch (error) {
        console.error("Error updating quote:", error);
        res.status(500).json({ message: "Server error" });
      }
};

export const getQuote = async (req: express.Request, res: express.Response): Promise<void> => {
    try {
        const { quoteId } = req.params;
    
        const quote = await Quote.findById(quoteId);
    
        if (!quote) {
          res.status(404).json({ message: "Quote not found" });
          return;
        }

        res.status(200).json(quote);
      } catch (error) {
        console.error("Error fetching quote:", error);
        res.status(500).json({ message: "Server error" });
      }
};

export const deleteQuote = async (req: express.Request, res: express.Response): Promise<void> => {
    try {
        const { quoteId } = req.params;
    
        const updatedQuote = await Quote.findByIdAndUpdate(
            quoteId, 
            { status: Status.Archived }, 
            { new: true, runValidators: true } 
          );
      
          if (!updatedQuote) {
            res.status(404).json({ message: "Quote not found" });
            return;
          }

        res.status(200).json(updatedQuote);
      } catch (error) {
        console.error("Error deleting quote:", error);
        res.status(500).json({ message: "Server error" });
      }
};

export const getQuotes = async (req: express.Request, res: express.Response): Promise<void> => {
    try {

        const { portalId } = req.query;
        let filter: any = { status: Status.Active};

        if (portalId) {
            filter.portalId = portalId;
        }
   
        const quotes = await Quote.find(filter);
      
        res.status(200).json(quotes);

      } catch (error) {
        console.error("Error fetching quotes:", error);
        res.status(500).json({ message: "Server error" });
      }
};
