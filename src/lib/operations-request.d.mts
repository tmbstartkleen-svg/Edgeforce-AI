export function createOperationsRequestScope(): {
 reset():void;
 begin(timeoutMs?:number):{signal:AbortSignal;isCurrent():boolean;finish():void};
};
export function readOperationsResponse<T>(response:Response):Promise<T>;
