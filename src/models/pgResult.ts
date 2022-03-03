export interface PgResult<T> {
    rows: T[];
}

export interface PgAnyResult {
    rows: any[];
}
