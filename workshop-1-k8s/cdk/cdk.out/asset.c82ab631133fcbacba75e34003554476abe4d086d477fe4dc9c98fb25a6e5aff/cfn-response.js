"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Retry = exports.safeHandler = exports.includeStackTraces = exports.submitResponse = exports.MISSING_PHYSICAL_ID_MARKER = exports.CREATE_FAILED_PHYSICAL_ID_MARKER = void 0;
// tslint:disable: max-line-length
// tslint:disable: no-console
const url = require("url");
const outbound_1 = require("./outbound");
const util_1 = require("./util");
exports.CREATE_FAILED_PHYSICAL_ID_MARKER = 'AWSCDK::CustomResourceProviderFramework::CREATE_FAILED';
exports.MISSING_PHYSICAL_ID_MARKER = 'AWSCDK::CustomResourceProviderFramework::MISSING_PHYSICAL_ID';
async function submitResponse(status, event, options = {}) {
    const json = {
        Status: status,
        Reason: options.reason || status,
        StackId: event.StackId,
        RequestId: event.RequestId,
        PhysicalResourceId: event.PhysicalResourceId || exports.MISSING_PHYSICAL_ID_MARKER,
        LogicalResourceId: event.LogicalResourceId,
        NoEcho: options.noEcho,
        Data: event.Data,
    };
    util_1.log('submit response to cloudformation', json);
    const responseBody = JSON.stringify(json);
    const parsedUrl = url.parse(event.ResponseURL);
    await outbound_1.httpRequest({
        hostname: parsedUrl.hostname,
        path: parsedUrl.path,
        method: 'PUT',
        headers: {
            'content-type': '',
            'content-length': responseBody.length,
        },
    }, responseBody);
}
exports.submitResponse = submitResponse;
exports.includeStackTraces = true; // for unit tests
function safeHandler(block) {
    return async (event) => {
        // ignore DELETE event when the physical resource ID is the marker that
        // indicates that this DELETE is a subsequent DELETE to a failed CREATE
        // operation.
        if (event.RequestType === 'Delete' && event.PhysicalResourceId === exports.CREATE_FAILED_PHYSICAL_ID_MARKER) {
            util_1.log('ignoring DELETE event caused by a failed CREATE event');
            await submitResponse('SUCCESS', event);
            return;
        }
        try {
            await block(event);
        }
        catch (e) {
            // tell waiter state machine to retry
            if (e instanceof Retry) {
                util_1.log('retry requested by handler');
                throw e;
            }
            if (!event.PhysicalResourceId) {
                // special case: if CREATE fails, which usually implies, we usually don't
                // have a physical resource id. in this case, the subsequent DELETE
                // operation does not have any meaning, and will likely fail as well. to
                // address this, we use a marker so the provider framework can simply
                // ignore the subsequent DELETE.
                if (event.RequestType === 'Create') {
                    util_1.log('CREATE failed, responding with a marker physical resource id so that the subsequent DELETE will be ignored');
                    event.PhysicalResourceId = exports.CREATE_FAILED_PHYSICAL_ID_MARKER;
                }
                else {
                    // otherwise, if PhysicalResourceId is not specified, something is
                    // terribly wrong because all other events should have an ID.
                    util_1.log(`ERROR: Malformed event. "PhysicalResourceId" is required: ${JSON.stringify(event)}`);
                }
            }
            // this is an actual error, fail the activity altogether and exist.
            await submitResponse('FAILED', event, {
                reason: exports.includeStackTraces ? e.stack : e.message,
            });
        }
    };
}
exports.safeHandler = safeHandler;
class Retry extends Error {
}
exports.Retry = Retry;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2ZuLXJlc3BvbnNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY2ZuLXJlc3BvbnNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLGtDQUFrQztBQUNsQyw2QkFBNkI7QUFDN0IsMkJBQTJCO0FBQzNCLHlDQUF5QztBQUN6QyxpQ0FBNkI7QUFFaEIsUUFBQSxnQ0FBZ0MsR0FBRyx3REFBd0QsQ0FBQztBQUM1RixRQUFBLDBCQUEwQixHQUFHLDhEQUE4RCxDQUFDO0FBZ0JsRyxLQUFLLFVBQVUsY0FBYyxDQUFDLE1BQTRCLEVBQUUsS0FBaUMsRUFBRSxVQUF5QyxFQUFHO0lBQ2hKLE1BQU0sSUFBSSxHQUFtRDtRQUMzRCxNQUFNLEVBQUUsTUFBTTtRQUNkLE1BQU0sRUFBRSxPQUFPLENBQUMsTUFBTSxJQUFJLE1BQU07UUFDaEMsT0FBTyxFQUFFLEtBQUssQ0FBQyxPQUFPO1FBQ3RCLFNBQVMsRUFBRSxLQUFLLENBQUMsU0FBUztRQUMxQixrQkFBa0IsRUFBRSxLQUFLLENBQUMsa0JBQWtCLElBQUksa0NBQTBCO1FBQzFFLGlCQUFpQixFQUFFLEtBQUssQ0FBQyxpQkFBaUI7UUFDMUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxNQUFNO1FBQ3RCLElBQUksRUFBRSxLQUFLLENBQUMsSUFBSTtLQUNqQixDQUFDO0lBRUYsVUFBRyxDQUFDLG1DQUFtQyxFQUFFLElBQUksQ0FBQyxDQUFDO0lBRS9DLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7SUFFMUMsTUFBTSxTQUFTLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDL0MsTUFBTSxzQkFBVyxDQUFDO1FBQ2hCLFFBQVEsRUFBRSxTQUFTLENBQUMsUUFBUTtRQUM1QixJQUFJLEVBQUUsU0FBUyxDQUFDLElBQUk7UUFDcEIsTUFBTSxFQUFFLEtBQUs7UUFDYixPQUFPLEVBQUU7WUFDUCxjQUFjLEVBQUUsRUFBRTtZQUNsQixnQkFBZ0IsRUFBRSxZQUFZLENBQUMsTUFBTTtTQUN0QztLQUNGLEVBQUUsWUFBWSxDQUFDLENBQUM7QUFDbkIsQ0FBQztBQTFCRCx3Q0EwQkM7QUFFVSxRQUFBLGtCQUFrQixHQUFHLElBQUksQ0FBQyxDQUFDLGlCQUFpQjtBQUV2RCxTQUFnQixXQUFXLENBQUMsS0FBb0M7SUFDOUQsT0FBTyxLQUFLLEVBQUUsS0FBVSxFQUFFLEVBQUU7UUFFMUIsdUVBQXVFO1FBQ3ZFLHVFQUF1RTtRQUN2RSxhQUFhO1FBQ2IsSUFBSSxLQUFLLENBQUMsV0FBVyxLQUFLLFFBQVEsSUFBSSxLQUFLLENBQUMsa0JBQWtCLEtBQUssd0NBQWdDLEVBQUU7WUFDbkcsVUFBRyxDQUFDLHVEQUF1RCxDQUFDLENBQUM7WUFDN0QsTUFBTSxjQUFjLENBQUMsU0FBUyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQ3ZDLE9BQU87U0FDUjtRQUVELElBQUk7WUFDRixNQUFNLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztTQUNwQjtRQUFDLE9BQU8sQ0FBQyxFQUFFO1lBQ1YscUNBQXFDO1lBQ3JDLElBQUksQ0FBQyxZQUFZLEtBQUssRUFBRTtnQkFDdEIsVUFBRyxDQUFDLDRCQUE0QixDQUFDLENBQUM7Z0JBQ2xDLE1BQU0sQ0FBQyxDQUFDO2FBQ1Q7WUFFRCxJQUFJLENBQUMsS0FBSyxDQUFDLGtCQUFrQixFQUFFO2dCQUM3Qix5RUFBeUU7Z0JBQ3pFLG1FQUFtRTtnQkFDbkUsd0VBQXdFO2dCQUN4RSxxRUFBcUU7Z0JBQ3JFLGdDQUFnQztnQkFDaEMsSUFBSSxLQUFLLENBQUMsV0FBVyxLQUFLLFFBQVEsRUFBRTtvQkFDbEMsVUFBRyxDQUFDLDRHQUE0RyxDQUFDLENBQUM7b0JBQ2xILEtBQUssQ0FBQyxrQkFBa0IsR0FBRyx3Q0FBZ0MsQ0FBQztpQkFDN0Q7cUJBQU07b0JBQ0wsa0VBQWtFO29CQUNsRSw2REFBNkQ7b0JBQzdELFVBQUcsQ0FBQyw2REFBNkQsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUM7aUJBQzNGO2FBQ0Y7WUFFRCxtRUFBbUU7WUFDbkUsTUFBTSxjQUFjLENBQUMsUUFBUSxFQUFFLEtBQUssRUFBRTtnQkFDcEMsTUFBTSxFQUFFLDBCQUFrQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTzthQUNqRCxDQUFDLENBQUM7U0FDSjtJQUNILENBQUMsQ0FBQztBQUNKLENBQUM7QUEzQ0Qsa0NBMkNDO0FBRUQsTUFBYSxLQUFNLFNBQVEsS0FBSztDQUFJO0FBQXBDLHNCQUFvQyIsInNvdXJjZXNDb250ZW50IjpbIi8vIHRzbGludDpkaXNhYmxlOiBtYXgtbGluZS1sZW5ndGhcbi8vIHRzbGludDpkaXNhYmxlOiBuby1jb25zb2xlXG5pbXBvcnQgKiBhcyB1cmwgZnJvbSAndXJsJztcbmltcG9ydCB7IGh0dHBSZXF1ZXN0IH0gZnJvbSAnLi9vdXRib3VuZCc7XG5pbXBvcnQgeyBsb2cgfSBmcm9tICcuL3V0aWwnO1xuXG5leHBvcnQgY29uc3QgQ1JFQVRFX0ZBSUxFRF9QSFlTSUNBTF9JRF9NQVJLRVIgPSAnQVdTQ0RLOjpDdXN0b21SZXNvdXJjZVByb3ZpZGVyRnJhbWV3b3JrOjpDUkVBVEVfRkFJTEVEJztcbmV4cG9ydCBjb25zdCBNSVNTSU5HX1BIWVNJQ0FMX0lEX01BUktFUiA9ICdBV1NDREs6OkN1c3RvbVJlc291cmNlUHJvdmlkZXJGcmFtZXdvcms6Ok1JU1NJTkdfUEhZU0lDQUxfSUQnO1xuXG5leHBvcnQgaW50ZXJmYWNlIENsb3VkRm9ybWF0aW9uUmVzcG9uc2VPcHRpb25zIHtcbiAgcmVhZG9ubHkgcmVhc29uPzogc3RyaW5nO1xuICByZWFkb25seSBub0VjaG8/OiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIENsb3VkRm9ybWF0aW9uRXZlbnRDb250ZXh0IHtcbiAgU3RhY2tJZDogc3RyaW5nO1xuICBSZXF1ZXN0SWQ6IHN0cmluZztcbiAgUGh5c2ljYWxSZXNvdXJjZUlkPzogc3RyaW5nO1xuICBMb2dpY2FsUmVzb3VyY2VJZDogc3RyaW5nO1xuICBSZXNwb25zZVVSTDogc3RyaW5nO1xuICBEYXRhPzogYW55XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzdWJtaXRSZXNwb25zZShzdGF0dXM6ICdTVUNDRVNTJyB8ICdGQUlMRUQnLCBldmVudDogQ2xvdWRGb3JtYXRpb25FdmVudENvbnRleHQsIG9wdGlvbnM6IENsb3VkRm9ybWF0aW9uUmVzcG9uc2VPcHRpb25zID0geyB9KSB7XG4gIGNvbnN0IGpzb246IEFXU0xhbWJkYS5DbG91ZEZvcm1hdGlvbkN1c3RvbVJlc291cmNlUmVzcG9uc2UgPSB7XG4gICAgU3RhdHVzOiBzdGF0dXMsXG4gICAgUmVhc29uOiBvcHRpb25zLnJlYXNvbiB8fCBzdGF0dXMsXG4gICAgU3RhY2tJZDogZXZlbnQuU3RhY2tJZCxcbiAgICBSZXF1ZXN0SWQ6IGV2ZW50LlJlcXVlc3RJZCxcbiAgICBQaHlzaWNhbFJlc291cmNlSWQ6IGV2ZW50LlBoeXNpY2FsUmVzb3VyY2VJZCB8fCBNSVNTSU5HX1BIWVNJQ0FMX0lEX01BUktFUixcbiAgICBMb2dpY2FsUmVzb3VyY2VJZDogZXZlbnQuTG9naWNhbFJlc291cmNlSWQsXG4gICAgTm9FY2hvOiBvcHRpb25zLm5vRWNobyxcbiAgICBEYXRhOiBldmVudC5EYXRhLFxuICB9O1xuXG4gIGxvZygnc3VibWl0IHJlc3BvbnNlIHRvIGNsb3VkZm9ybWF0aW9uJywganNvbik7XG5cbiAgY29uc3QgcmVzcG9uc2VCb2R5ID0gSlNPTi5zdHJpbmdpZnkoanNvbik7XG5cbiAgY29uc3QgcGFyc2VkVXJsID0gdXJsLnBhcnNlKGV2ZW50LlJlc3BvbnNlVVJMKTtcbiAgYXdhaXQgaHR0cFJlcXVlc3Qoe1xuICAgIGhvc3RuYW1lOiBwYXJzZWRVcmwuaG9zdG5hbWUsXG4gICAgcGF0aDogcGFyc2VkVXJsLnBhdGgsXG4gICAgbWV0aG9kOiAnUFVUJyxcbiAgICBoZWFkZXJzOiB7XG4gICAgICAnY29udGVudC10eXBlJzogJycsXG4gICAgICAnY29udGVudC1sZW5ndGgnOiByZXNwb25zZUJvZHkubGVuZ3RoLFxuICAgIH0sXG4gIH0sIHJlc3BvbnNlQm9keSk7XG59XG5cbmV4cG9ydCBsZXQgaW5jbHVkZVN0YWNrVHJhY2VzID0gdHJ1ZTsgLy8gZm9yIHVuaXQgdGVzdHNcblxuZXhwb3J0IGZ1bmN0aW9uIHNhZmVIYW5kbGVyKGJsb2NrOiAoZXZlbnQ6IGFueSkgPT4gUHJvbWlzZTx2b2lkPikge1xuICByZXR1cm4gYXN5bmMgKGV2ZW50OiBhbnkpID0+IHtcblxuICAgIC8vIGlnbm9yZSBERUxFVEUgZXZlbnQgd2hlbiB0aGUgcGh5c2ljYWwgcmVzb3VyY2UgSUQgaXMgdGhlIG1hcmtlciB0aGF0XG4gICAgLy8gaW5kaWNhdGVzIHRoYXQgdGhpcyBERUxFVEUgaXMgYSBzdWJzZXF1ZW50IERFTEVURSB0byBhIGZhaWxlZCBDUkVBVEVcbiAgICAvLyBvcGVyYXRpb24uXG4gICAgaWYgKGV2ZW50LlJlcXVlc3RUeXBlID09PSAnRGVsZXRlJyAmJiBldmVudC5QaHlzaWNhbFJlc291cmNlSWQgPT09IENSRUFURV9GQUlMRURfUEhZU0lDQUxfSURfTUFSS0VSKSB7XG4gICAgICBsb2coJ2lnbm9yaW5nIERFTEVURSBldmVudCBjYXVzZWQgYnkgYSBmYWlsZWQgQ1JFQVRFIGV2ZW50Jyk7XG4gICAgICBhd2FpdCBzdWJtaXRSZXNwb25zZSgnU1VDQ0VTUycsIGV2ZW50KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgYXdhaXQgYmxvY2soZXZlbnQpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIC8vIHRlbGwgd2FpdGVyIHN0YXRlIG1hY2hpbmUgdG8gcmV0cnlcbiAgICAgIGlmIChlIGluc3RhbmNlb2YgUmV0cnkpIHtcbiAgICAgICAgbG9nKCdyZXRyeSByZXF1ZXN0ZWQgYnkgaGFuZGxlcicpO1xuICAgICAgICB0aHJvdyBlO1xuICAgICAgfVxuXG4gICAgICBpZiAoIWV2ZW50LlBoeXNpY2FsUmVzb3VyY2VJZCkge1xuICAgICAgICAvLyBzcGVjaWFsIGNhc2U6IGlmIENSRUFURSBmYWlscywgd2hpY2ggdXN1YWxseSBpbXBsaWVzLCB3ZSB1c3VhbGx5IGRvbid0XG4gICAgICAgIC8vIGhhdmUgYSBwaHlzaWNhbCByZXNvdXJjZSBpZC4gaW4gdGhpcyBjYXNlLCB0aGUgc3Vic2VxdWVudCBERUxFVEVcbiAgICAgICAgLy8gb3BlcmF0aW9uIGRvZXMgbm90IGhhdmUgYW55IG1lYW5pbmcsIGFuZCB3aWxsIGxpa2VseSBmYWlsIGFzIHdlbGwuIHRvXG4gICAgICAgIC8vIGFkZHJlc3MgdGhpcywgd2UgdXNlIGEgbWFya2VyIHNvIHRoZSBwcm92aWRlciBmcmFtZXdvcmsgY2FuIHNpbXBseVxuICAgICAgICAvLyBpZ25vcmUgdGhlIHN1YnNlcXVlbnQgREVMRVRFLlxuICAgICAgICBpZiAoZXZlbnQuUmVxdWVzdFR5cGUgPT09ICdDcmVhdGUnKSB7XG4gICAgICAgICAgbG9nKCdDUkVBVEUgZmFpbGVkLCByZXNwb25kaW5nIHdpdGggYSBtYXJrZXIgcGh5c2ljYWwgcmVzb3VyY2UgaWQgc28gdGhhdCB0aGUgc3Vic2VxdWVudCBERUxFVEUgd2lsbCBiZSBpZ25vcmVkJyk7XG4gICAgICAgICAgZXZlbnQuUGh5c2ljYWxSZXNvdXJjZUlkID0gQ1JFQVRFX0ZBSUxFRF9QSFlTSUNBTF9JRF9NQVJLRVI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gb3RoZXJ3aXNlLCBpZiBQaHlzaWNhbFJlc291cmNlSWQgaXMgbm90IHNwZWNpZmllZCwgc29tZXRoaW5nIGlzXG4gICAgICAgICAgLy8gdGVycmlibHkgd3JvbmcgYmVjYXVzZSBhbGwgb3RoZXIgZXZlbnRzIHNob3VsZCBoYXZlIGFuIElELlxuICAgICAgICAgIGxvZyhgRVJST1I6IE1hbGZvcm1lZCBldmVudC4gXCJQaHlzaWNhbFJlc291cmNlSWRcIiBpcyByZXF1aXJlZDogJHtKU09OLnN0cmluZ2lmeShldmVudCl9YCk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gdGhpcyBpcyBhbiBhY3R1YWwgZXJyb3IsIGZhaWwgdGhlIGFjdGl2aXR5IGFsdG9nZXRoZXIgYW5kIGV4aXN0LlxuICAgICAgYXdhaXQgc3VibWl0UmVzcG9uc2UoJ0ZBSUxFRCcsIGV2ZW50LCB7XG4gICAgICAgIHJlYXNvbjogaW5jbHVkZVN0YWNrVHJhY2VzID8gZS5zdGFjayA6IGUubWVzc2FnZSxcbiAgICAgIH0pO1xuICAgIH1cbiAgfTtcbn1cblxuZXhwb3J0IGNsYXNzIFJldHJ5IGV4dGVuZHMgRXJyb3IgeyB9XG4iXX0=