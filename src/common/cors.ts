import {FunctionResult, HttpRequest, InvocationContext} from "@azure/functions"
import {HttpResponse, HttpResponseInit} from "@azure/functions/types/http"

export const corsHeaders = {
    "Access-Control-Allow-Origin": "*", // uncritical as this is ignored by azure
    "Access-Control-Expose-Headers": "Thread-ID",
    "Access-Control-Allow-Headers": "Content-Type, Session-ID",
}

export function corsOptionsHandler(request: HttpRequest, context: InvocationContext): FunctionResult<HttpResponseInit | HttpResponse> {
    return {
        headers: corsHeaders,
        status: 200
    }
}
