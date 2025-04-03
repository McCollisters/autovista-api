import express from "express";
import { Quote } from "./schema";
import { Status } from '../_global/enums'
import { getCoordinates } from "../_global/utils/location";
import { getMiles } from "./services/getMiles";
import { updateVehiclesWithPricing } from "./services/updateVehiclesWithPricing";
import { calculateTotalPricing } from "./services/calculateTotalPricing";
import { validateLocation } from "./services/validateLocation";

export const createQuote = async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
    try {
        const { portalId, userId, customer, origin, destination, transportType, vehicles, commission } = req.body;

        let originState : string | null; 
        let originLocation : string;
        let destinationState : string | null; 
        let destinationLocation : string;

        const originValidated = await validateLocation(origin);
        if (originValidated.error) {
          return next({statusCode: 500, message: originValidated.error});
        }

        originState = originValidated.state;
        originLocation = originValidated.location || origin;

        const destinationValidated = await validateLocation(destination);
        if (destinationValidated.error) {
          return next({statusCode: 500, message: destinationValidated.error});
        }

        destinationState = destinationValidated.state;
        destinationLocation = destinationValidated.location || destination;

        const originCoords = await getCoordinates(originLocation);
        const destinationCoords = await getCoordinates(destinationLocation);

        if (!originCoords || !destinationCoords) {
          return next({statusCode: 500, message: "Error getting location coordinates"});
        }

        const miles = await getMiles(originCoords, destinationCoords);

        if (!miles) {
          return next({statusCode: 500, message: "Error getting miles"});
        }

        const vehicleQuotes = await updateVehiclesWithPricing({ portalId, vehicles, originLocation, originState, destinationLocation, destinationState, commission});

        const totalPricing = await calculateTotalPricing(vehicleQuotes);

        const formattedQuote =  {
          status: Status.Active,
          portalId,
          userId,
          customer,
          origin: {
            userInput: origin,
            validated: originLocation,
            long: originCoords[0],
            lat: originCoords[1],
            state: originState
          },
          destination: {
            userInput: destination,
            validated: destinationLocation,
            long: destinationCoords[0],
            lat: destinationCoords[1],
            state: destinationState
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
