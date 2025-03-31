import { Router } from "express";
import { 
  createQuote,
  getQuote,
  updateQuote,
  deleteQuote,
  getQuotes
} from "./controller";
// import { validateQuoteBody } from "./middleware/validateQuoteBody";

const router = Router(); 

router.get("/", getQuotes);
router.post("/", createQuote);
router.get("/:quoteId", getQuote); 
router.put("/:quoteId", updateQuote); 
router.delete("/:quoteId",deleteQuote); 

export default router; 
