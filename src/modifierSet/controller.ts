import express from "express";
import { Rule } from "./schema";
import { Status } from '../_global/enums'

export const createRule = async (req: express.Request, res: express.Response): Promise<void> => {
    try {
        const rule = { ...req.body, status: Status.Active }
        const createdRule = await new Rule(rule).save()
        res.status(200).send(createdRule);
    } catch (error) {
        console.error("Error creating rule:", error);
        res.status(500).json({ message: "Server error" });
    }
};

export const updateRule = async (req: express.Request, res: express.Response): Promise<void> => {
    try {
        const { ruleId } = req.params;
    
        const updatedRule = await Rule.findByIdAndUpdate(
          ruleId, 
          req.body, 
          { new: true, runValidators: true } 
        );
    
        if (!updatedRule) {
          res.status(404).json({ message: "Rule not found" });
          return;
        }

        res.status(200).json(updatedRule);
      } catch (error) {
        console.error("Error updating rule:", error);
        res.status(500).json({ message: "Server error" });
      }
};

export const getRule = async (req: express.Request, res: express.Response): Promise<void> => {
    try {
        const { ruleId } = req.params;
    
        const rule = await Rule.findById(ruleId);
    
        if (!rule) {
          res.status(404).json({ message: "Rule not found" });
          return;
        }

        res.status(200).json(rule);
      } catch (error) {
        console.error("Error fetching rule:", error);
        res.status(500).json({ message: "Server error" });
      }
};

export const deleteRule = async (req: express.Request, res: express.Response): Promise<void> => {
    try {
        const { ruleId } = req.params;
    
        const updatedRule = await Rule.findByIdAndUpdate(
            ruleId, 
            { status: Status.Archived }, 
            { new: true, runValidators: true } 
          );
      
          if (!updatedRule) {
            res.status(404).json({ message: "Rule not found" });
            return;
          }

        res.status(200).json(updatedRule);
      } catch (error) {
        console.error("Error deleting rule:", error);
        res.status(500).json({ message: "Server error" });
      }
};

export const getRules = async (req: express.Request, res: express.Response): Promise<void> => {
    try {

        const { portalId, role } = req.query;
        let filter: any = { status: Status.Active};

        if (portalId) {
            filter.portalId = portalId;
        }

        if (role) {
            filter.role = role;
        }
   
        const rules = await Rule.find(filter);
      
        res.status(200).json(rules);

      } catch (error) {
        console.error("Error fetching rules:", error);
        res.status(500).json({ message: "Server error" });
      }
};
