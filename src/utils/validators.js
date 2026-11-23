// Positive safe integer ID. The caller decides how to convert the raw value (e.g. Number(req.params.tableId)).
export const isPositiveId = (value) => Number.isSafeInteger(value) && value > 0;
