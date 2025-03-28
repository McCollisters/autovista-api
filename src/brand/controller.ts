import express from "express";

export const helloWorld = (req: express.Request, res: express.Response): void => {
    res.send("Hello World!");
    console.log("Response sent");
  };
  