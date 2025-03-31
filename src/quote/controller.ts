import express from "express";
import { Quote } from "./schema";
import { Status } from '../_global/enums'
import { getCoordinates } from "./services/getCoordinates";
import { getMiles } from "./services/getMiles";
import { updateVehiclesWithPricing } from "./services/updateVehiclesWithPricing";
import { calculateTotalPricing } from "./services/calculateTotalPricing";
import { validateLocation } from "./services/validateLocation";

export const createQuote = async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
    try {
        const { portalId, userId, customer, origin, destination, transportType, vehicles } = req.body;

        const originValidated = await validateLocation(origin);
        if (originValidated.error) {
          return next({statusCode: 500, message: originValidated.error});
        }

        const destinationValidated = await validateLocation(destination);
        if (destinationValidated.error) {
          return next({statusCode: 500, message: destinationValidated.error});
        }

        const originCoords = await getCoordinates(originValidated.location);
        const destinationCoords = await getCoordinates(destinationValidated.location);
        if (!originCoords || !destinationCoords) {
          return next({statusCode: 500, message: "Error getting location coordinates"});
        }

        const miles = await getMiles(originCoords, destinationCoords);

        if (!miles) {
          return next({statusCode: 500, message: "error getting mileage"});
        }

        const vehicleQuotes = await updateVehiclesWithPricing(portalId, vehicles, originValidated.location, destinationValidated.location);
        const totalPricing = await calculateTotalPricing(vehicleQuotes);

        const formattedQuote =  {
          status: Status.Active,
          portalId,
          userId,
          customer,
          origin: {
            userInput: origin,
            validated: originValidated.location,
            long: originCoords[0],
            lat: originCoords[1]
          },
          destination: {
            userInput: destination,
            validated: destinationValidated.location,
            long: destinationCoords[0],
            lat: destinationCoords[1]
          },
          miles,
          transportType,
          vehicles: vehicleQuotes, 
          totalPricing
        }

        const createdQuote = await new Quote(formattedQuote).save()
        res.status(200).send(createdQuote);
    } catch (error) {
        console.error(error);
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
