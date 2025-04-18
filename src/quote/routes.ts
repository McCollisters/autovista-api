import { Router } from "express";
import { createQuote } from "./controllers/createQuote";
import { getQuote } from "./controllers/getQuote";
import { getQuotes } from "./controllers/getQuotes";
import { updateQuote } from "./controllers/updateQuote";
import { validateQuoteBody } from "./middleware/validateQuoteBody";

const router = Router();

router.get("/", getQuotes);
router.post("/", validateQuoteBody, createQuote);
router.get("/:quoteId", getQuote);
router.put("/:quoteId", updateQuote);
// router.delete("/:quoteId",deleteQuote);

export default router;
