import { Request, Response, NextFunction } from "express";

export const ErrorHandler = (err: any, req: Request, res: Response, next: NextFunction): void => {
    let errStatus: number = err.statusCode || 500;
    let errMsg: string = err.message || "Something went wrong";

    if (errMsg === "Your session has expired. Please log in again.") {
        errStatus = 401;
    }
    res.status(errStatus).json({
        success: false,
        status: errStatus,
        message: errMsg,
        stack: process.env.NODE_ENV === "development" ? err.stack : {},
    });
};
