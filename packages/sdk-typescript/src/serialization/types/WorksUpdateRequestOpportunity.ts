/**
 * This file was auto-generated by Fern from our API Definition.
 */

import * as serializers from "../index";
import * as DevRev from "../../api/index";
import * as core from "../../core";
import { WorksUpdateRequestOpportunityContacts } from "./WorksUpdateRequestOpportunityContacts";

export const WorksUpdateRequestOpportunity: core.serialization.ObjectSchema<
    serializers.WorksUpdateRequestOpportunity.Raw,
    DevRev.WorksUpdateRequestOpportunity
> = core.serialization.object({
    account: core.serialization.string().optional(),
    amount: core.serialization.number().optional(),
    contacts: WorksUpdateRequestOpportunityContacts.optional(),
    customerBudget: core.serialization.property("customer_budget", core.serialization.number().optional()),
    forecastCategoryV2: core.serialization.property("forecast_category_v2", core.serialization.number().optional()),
    probability: core.serialization.number().optional(),
});

export declare namespace WorksUpdateRequestOpportunity {
    interface Raw {
        account?: string | null;
        amount?: number | null;
        contacts?: WorksUpdateRequestOpportunityContacts.Raw | null;
        customer_budget?: number | null;
        forecast_category_v2?: number | null;
        probability?: number | null;
    }
}
