"use strict";
// tslint:disable: no-console
Object.defineProperty(exports, "__esModule", { value: true });
exports.log = exports.getEnv = void 0;
function getEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`The environment variable "${name}" is not defined`);
    }
    return value;
}
exports.getEnv = getEnv;
function log(title, ...args) {
    console.log('[provider-framework]', title, ...args.map(x => typeof (x) === 'object' ? JSON.stringify(x, undefined, 2) : x));
}
exports.log = log;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInV0aWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLDZCQUE2Qjs7O0FBRTdCLFNBQWdCLE1BQU0sQ0FBQyxJQUFZO0lBQ2pDLE1BQU0sS0FBSyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDaEMsSUFBSSxDQUFDLEtBQUssRUFBRTtRQUNWLE1BQU0sSUFBSSxLQUFLLENBQUMsNkJBQTZCLElBQUksa0JBQWtCLENBQUMsQ0FBQztLQUN0RTtJQUNELE9BQU8sS0FBSyxDQUFDO0FBQ2YsQ0FBQztBQU5ELHdCQU1DO0FBRUQsU0FBZ0IsR0FBRyxDQUFDLEtBQVUsRUFBRSxHQUFHLElBQVc7SUFDNUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxzQkFBc0IsRUFBRSxLQUFLLEVBQUUsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsT0FBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzdILENBQUM7QUFGRCxrQkFFQyIsInNvdXJjZXNDb250ZW50IjpbIi8vIHRzbGludDpkaXNhYmxlOiBuby1jb25zb2xlXG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRFbnYobmFtZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgY29uc3QgdmFsdWUgPSBwcm9jZXNzLmVudltuYW1lXTtcbiAgaWYgKCF2YWx1ZSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgVGhlIGVudmlyb25tZW50IHZhcmlhYmxlIFwiJHtuYW1lfVwiIGlzIG5vdCBkZWZpbmVkYCk7XG4gIH1cbiAgcmV0dXJuIHZhbHVlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbG9nKHRpdGxlOiBhbnksIC4uLmFyZ3M6IGFueVtdKSB7XG4gIGNvbnNvbGUubG9nKCdbcHJvdmlkZXItZnJhbWV3b3JrXScsIHRpdGxlLCAuLi5hcmdzLm1hcCh4ID0+IHR5cGVvZih4KSA9PT0gJ29iamVjdCcgPyBKU09OLnN0cmluZ2lmeSh4LCB1bmRlZmluZWQsIDIpIDogeCkpO1xufVxuIl19