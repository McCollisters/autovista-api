import { Rule, IRule } from "../../rule/schema"

export async function getPortalModifiers(portalId: string): Promise<Array<IRule>> {
    const rules = await Rule.find({ portalId });
    return rules;
}