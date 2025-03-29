import express from "express";
import { Quote } from "./schema";
import { Status } from '../_global/enums'

export const createQuote = async (req: express.Request, res: express.Response): Promise<void> => {
    try {
        const quote = { ...req.body, status: Status.Active }
        const createdQuote = await new Quote(quote).save()
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

        const { portalId, role } = req.query;
        let filter: any = { status: Status.Active};

        if (portalId) {
            filter.portalId = portalId;
        }

        if (role) {
            filter.role = role;
        }
   
        const quotes = await Quote.find(filter);
      
        res.status(200).json(quotes);

      } catch (error) {
        console.error("Error fetching quotes:", error);
        res.status(500).json({ message: "Server error" });
      }
};
