import { Router } from "express";
import { 
  createQuote,
} from "./controllers/createQuote";
// import { validateQuoteBody } from "./middleware/validateQuoteBody";

const router = Router(); 

// router.get("/", getQuotes);
router.post("/", createQuote);
// router.get("/:quoteId", getQuote); 
// router.put("/:quoteId", updateQuote); 
// router.delete("/:quoteId",deleteQuote); 

export default router; 
