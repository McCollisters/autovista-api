import { Rule, IRule } from "../../rule/schema"

export async function getGlobalModifiers(): Promise<Array<IRule>> {
    const rules = await Rule.find({});
    return rules;
}
  