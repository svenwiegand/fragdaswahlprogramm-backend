import Mixpanel from "mixpanel"
import {HttpRequest} from "@azure/functions"

export const mixpanel = Mixpanel.init(process.env.MIXPANEL_PROJECT_TOKEN, {
    host: "api-eu.mixpanel.com"
})

export type SessionID = string | undefined
export function getSessionId(request: HttpRequest): SessionID {
    return request.headers.get("Session-ID") || undefined
}

export type MixpanelEvent = {
    distinct_id: string,
    ip: string,
}

export const getMixpanelEvent = (request: HttpRequest): MixpanelEvent => ({
    distinct_id: getSessionId(request) || "anonymous",
    ip: request.headers.get("x-forwarded-for") || "unknown",
})

export class EventBuilder<Event extends MixpanelEvent> {
    readonly eventName: string
    private event: Event

    constructor(eventName: string, event: Event) {
        this.eventName = eventName
        this.event = event
    }

    public patch(patch: Partial<Event>): void {
        this.event = {...this.event, ...patch}
    }

    public update(updater: (event: Event) => Partial<Event>): void {
        this.patch(updater(this.event))
    }

    public getEvent(): Event {
        return this.event
    }

    public send(): void {
        mixpanel.track(this.eventName, this.event)
    }
}