import { Request, Response, NextFunction } from 'express';
import { IQuote } from "../schema"; 

export const validateQuoteBody = (req: Request, res: Response, next: NextFunction) => {
    const data: Partial<IQuote> = req.body;
    const errors: Record<string, string> = {};

    if (!data.portalId) {
        errors.portalId = "portalId is required.";
    }

    if (!data.userId) {
        errors.userId = "userId is required.";
    }

    if (!data.origin) {
        errors.origin = "Origin is required.";
    }

    if (!data.destination) {
        errors.destination = "Destination is required.";
    }

    if (!data.vehicles || !Array.isArray(data.vehicles) || data.vehicles.length === 0) {
        errors.vehicles = "At least one vehicle is required.";
    } else {
        data.vehicles.forEach((vehicle, index) => {
        if (!vehicle.make || typeof vehicle.make !== "string") {
            errors[`vehicles[${index}].make`] = "Vehicle make is required.";
        }
        if (!vehicle.model || typeof vehicle.model !== "string") {
            errors[`vehicles[${index}].model`] = "Vehicle model is required.";
        }
        if (typeof vehicle.isInoperable !== "boolean") {
            errors[`vehicles[${index}].isOperable`] = "Vehicle operable status must be boolean.";
        }
        });
    }

    if (Object.keys(errors).length > 0) {
        return res.status(400).json({ errors });
    }

    next();
}
