export class RelationshipHistory {
    id?: string;
    user_id: string;
    event_type: string;
    new_value: string;
    trigger_message?: string;
    created_at?: Date;

    constructor(partial: Partial<RelationshipHistory>) {
        Object.assign(this, partial);
    }
}
