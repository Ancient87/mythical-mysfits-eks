"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FargateProfileResourceHandler = void 0;
const common_1 = require("./common");
const MAX_NAME_LEN = 63;
class FargateProfileResourceHandler extends common_1.ResourceHandler {
    async onCreate() {
        var _a;
        const fargateProfileName = (_a = this.event.ResourceProperties.Config.fargateProfileName) !== null && _a !== void 0 ? _a : this.generateProfileName();
        const createFargateProfile = {
            fargateProfileName,
            ...this.event.ResourceProperties.Config,
        };
        this.log({ createFargateProfile });
        const createFargateProfileResponse = await this.eks.createFargateProfile(createFargateProfile);
        this.log({ createFargateProfileResponse });
        if (!createFargateProfileResponse.fargateProfile) {
            throw new Error('invalid CreateFargateProfile response');
        }
        return {
            PhysicalResourceId: createFargateProfileResponse.fargateProfile.fargateProfileName,
            Data: {
                fargateProfileArn: createFargateProfileResponse.fargateProfile.fargateProfileArn,
            },
        };
    }
    async onDelete() {
        if (!this.physicalResourceId) {
            throw new Error('Cannot delete a profile without a physical id');
        }
        const deleteFargateProfile = {
            clusterName: this.event.ResourceProperties.Config.clusterName,
            fargateProfileName: this.physicalResourceId,
        };
        this.log({ deleteFargateProfile });
        const deleteFargateProfileResponse = await this.eks.deleteFargateProfile(deleteFargateProfile);
        this.log({ deleteFargateProfileResponse });
        return;
    }
    async onUpdate() {
        // all updates require a replacement. as long as name is generated, we are
        // good. if name is explicit, update will fail, which is common when trying
        // to replace cfn resources with explicit physical names
        return this.onCreate();
    }
    async isCreateComplete() {
        return this.isUpdateComplete();
    }
    async isUpdateComplete() {
        const status = await this.queryStatus();
        return {
            IsComplete: status === 'ACTIVE',
        };
    }
    async isDeleteComplete() {
        const status = await this.queryStatus();
        return {
            IsComplete: status === 'NOT_FOUND',
        };
    }
    /**
     * Generates a fargate profile name.
     */
    generateProfileName() {
        const suffix = this.requestId.replace(/-/g, ''); // 32 chars
        const prefix = this.logicalResourceId.substr(0, MAX_NAME_LEN - suffix.length - 1);
        return `${prefix}-${suffix}`;
    }
    /**
     * Queries the Fargate profile's current status and returns the status or
     * NOT_FOUND if the profile doesn't exist (i.e. it has been deleted).
     */
    async queryStatus() {
        var _a;
        if (!this.physicalResourceId) {
            throw new Error('Unable to determine status for fargate profile without a resource name');
        }
        const describeFargateProfile = {
            clusterName: this.event.ResourceProperties.Config.clusterName,
            fargateProfileName: this.physicalResourceId,
        };
        try {
            this.log({ describeFargateProfile });
            const describeFargateProfileResponse = await this.eks.describeFargateProfile(describeFargateProfile);
            this.log({ describeFargateProfileResponse });
            const status = (_a = describeFargateProfileResponse.fargateProfile) === null || _a === void 0 ? void 0 : _a.status;
            if (status === 'CREATE_FAILED' || status === 'DELETE_FAILED') {
                throw new Error(status);
            }
            return status;
        }
        catch (describeFargateProfileError) {
            if (describeFargateProfileError.code === 'ResourceNotFoundException') {
                this.log('received ResourceNotFoundException, this means the profile has been deleted (or never existed)');
                return 'NOT_FOUND';
            }
            this.log({ describeFargateProfileError });
            throw describeFargateProfileError;
        }
    }
}
exports.FargateProfileResourceHandler = FargateProfileResourceHandler;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmFyZ2F0ZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImZhcmdhdGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscUNBQTJDO0FBSzNDLE1BQU0sWUFBWSxHQUFHLEVBQUUsQ0FBQztBQUV4QixNQUFhLDZCQUE4QixTQUFRLHdCQUFlO0lBQ3RELEtBQUssQ0FBQyxRQUFROztRQUN0QixNQUFNLGtCQUFrQixTQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsa0JBQWtCLENBQUMsTUFBTSxDQUFDLGtCQUFrQixtQ0FBSSxJQUFJLENBQUMsbUJBQW1CLEVBQUUsQ0FBQztRQUVqSCxNQUFNLG9CQUFvQixHQUF3QztZQUNoRSxrQkFBa0I7WUFDbEIsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLGtCQUFrQixDQUFDLE1BQU07U0FDeEMsQ0FBQztRQUVGLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxvQkFBb0IsRUFBRSxDQUFDLENBQUM7UUFDbkMsTUFBTSw0QkFBNEIsR0FBRyxNQUFNLElBQUksQ0FBQyxHQUFHLENBQUMsb0JBQW9CLENBQUMsb0JBQW9CLENBQUMsQ0FBQztRQUMvRixJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsNEJBQTRCLEVBQUUsQ0FBQyxDQUFDO1FBRTNDLElBQUksQ0FBQyw0QkFBNEIsQ0FBQyxjQUFjLEVBQUU7WUFDaEQsTUFBTSxJQUFJLEtBQUssQ0FBQyx1Q0FBdUMsQ0FBQyxDQUFDO1NBQzFEO1FBRUQsT0FBTztZQUNMLGtCQUFrQixFQUFFLDRCQUE0QixDQUFDLGNBQWMsQ0FBQyxrQkFBa0I7WUFDbEYsSUFBSSxFQUFFO2dCQUNKLGlCQUFpQixFQUFFLDRCQUE0QixDQUFDLGNBQWMsQ0FBQyxpQkFBaUI7YUFDakY7U0FDRixDQUFDO0lBQ0osQ0FBQztJQUVTLEtBQUssQ0FBQyxRQUFRO1FBQ3RCLElBQUksQ0FBQyxJQUFJLENBQUMsa0JBQWtCLEVBQUU7WUFDNUIsTUFBTSxJQUFJLEtBQUssQ0FBQywrQ0FBK0Ms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Z0JBQzNHLE9BQU8sV0FBVyxDQUFDO2FBQ3BCO1lBRUQsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLDJCQUEyQixFQUFFLENBQUMsQ0FBQztZQUMxQyxNQUFNLDJCQUEyQixDQUFDO1NBQ25DO0lBQ0gsQ0FBQztDQUNGO0FBaEhELHNFQWdIQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFJlc291cmNlSGFuZGxlciB9IGZyb20gJy4vY29tbW9uJztcblxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGltcG9ydC9uby1leHRyYW5lb3VzLWRlcGVuZGVuY2llc1xuaW1wb3J0ICogYXMgYXdzIGZyb20gJ2F3cy1zZGsnO1xuXG5jb25zdCBNQVhfTkFNRV9MRU4gPSA2MztcblxuZXhwb3J0IGNsYXNzIEZhcmdhdGVQcm9maWxlUmVzb3VyY2VIYW5kbGVyIGV4dGVuZHMgUmVzb3VyY2VIYW5kbGVyIHtcbiAgcHJvdGVjdGVkIGFzeW5jIG9uQ3JlYXRlKCkge1xuICAgIGNvbnN0IGZhcmdhdGVQcm9maWxlTmFtZSA9IHRoaXMuZXZlbnQuUmVzb3VyY2VQcm9wZXJ0aWVzLkNvbmZpZy5mYXJnYXRlUHJvZmlsZU5hbWUgPz8gdGhpcy5nZW5lcmF0ZVByb2ZpbGVOYW1lKCk7XG5cbiAgICBjb25zdCBjcmVhdGVGYXJnYXRlUHJvZmlsZTogYXdzLkVLUy5DcmVhdGVGYXJnYXRlUHJvZmlsZVJlcXVlc3QgPSB7XG4gICAgICBmYXJnYXRlUHJvZmlsZU5hbWUsXG4gICAgICAuLi50aGlzLmV2ZW50LlJlc291cmNlUHJvcGVydGllcy5Db25maWcsXG4gICAgfTtcblxuICAgIHRoaXMubG9nKHsgY3JlYXRlRmFyZ2F0ZVByb2ZpbGUgfSk7XG4gICAgY29uc3QgY3JlYXRlRmFyZ2F0ZVByb2ZpbGVSZXNwb25zZSA9IGF3YWl0IHRoaXMuZWtzLmNyZWF0ZUZhcmdhdGVQcm9maWxlKGNyZWF0ZUZhcmdhdGVQcm9maWxlKTtcbiAgICB0aGlzLmxvZyh7IGNyZWF0ZUZhcmdhdGVQcm9maWxlUmVzcG9uc2UgfSk7XG5cbiAgICBpZiAoIWNyZWF0ZUZhcmdhdGVQcm9maWxlUmVzcG9uc2UuZmFyZ2F0ZVByb2ZpbGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignaW52YWxpZCBDcmVhdGVGYXJnYXRlUHJvZmlsZSByZXNwb25zZScpO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBQaHlzaWNhbFJlc291cmNlSWQ6IGNyZWF0ZUZhcmdhdGVQcm9maWxlUmVzcG9uc2UuZmFyZ2F0ZVByb2ZpbGUuZmFyZ2F0ZVByb2ZpbGVOYW1lLFxuICAgICAgRGF0YToge1xuICAgICAgICBmYXJnYXRlUHJvZmlsZUFybjogY3JlYXRlRmFyZ2F0ZVByb2ZpbGVSZXNwb25zZS5mYXJnYXRlUHJvZmlsZS5mYXJnYXRlUHJvZmlsZUFybixcbiAgICAgIH0sXG4gICAgfTtcbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBvbkRlbGV0ZSgpIHtcbiAgICBpZiAoIXRoaXMucGh5c2ljYWxSZXNvdXJjZUlkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBkZWxldGUgYSBwcm9maWxlIHdpdGhvdXQgYSBwaHlzaWNhbCBpZCcpO1xuICAgIH1cblxuICAgIGNvbnN0IGRlbGV0ZUZhcmdhdGVQcm9maWxlOiBhd3MuRUtTLkRlbGV0ZUZhcmdhdGVQcm9maWxlUmVxdWVzdCA9IHtcbiAgICAgIGNsdXN0ZXJOYW1lOiB0aGlzLmV2ZW50LlJlc291cmNlUHJvcGVydGllcy5Db25maWcuY2x1c3Rlck5hbWUsXG4gICAgICBmYXJnYXRlUHJvZmlsZU5hbWU6IHRoaXMucGh5c2ljYWxSZXNvdXJjZUlkLFxuICAgIH07XG5cbiAgICB0aGlzLmxvZyh7IGRlbGV0ZUZhcmdhdGVQcm9maWxlIH0pO1xuICAgIGNvbnN0IGRlbGV0ZUZhcmdhdGVQcm9maWxlUmVzcG9uc2UgPSBhd2FpdCB0aGlzLmVrcy5kZWxldGVGYXJnYXRlUHJvZmlsZShkZWxldGVGYXJnYXRlUHJvZmlsZSk7XG4gICAgdGhpcy5sb2coeyBkZWxldGVGYXJnYXRlUHJvZmlsZVJlc3BvbnNlIH0pO1xuXG4gICAgcmV0dXJuO1xuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIG9uVXBkYXRlKCkge1xuICAgIC8vIGFsbCB1cGRhdGVzIHJlcXVpcmUgYSByZXBsYWNlbWVudC4gYXMgbG9uZyBhcyBuYW1lIGlzIGdlbmVyYXRlZCwgd2UgYXJlXG4gICAgLy8gZ29vZC4gaWYgbmFtZSBpcyBleHBsaWNpdCwgdXBkYXRlIHdpbGwgZmFpbCwgd2hpY2ggaXMgY29tbW9uIHdoZW4gdHJ5aW5nXG4gICAgLy8gdG8gcmVwbGFjZSBjZm4gcmVzb3VyY2VzIHdpdGggZXhwbGljaXQgcGh5c2ljYWwgbmFtZXNcbiAgICByZXR1cm4gdGhpcy5vbkNyZWF0ZSgpO1xuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIGlzQ3JlYXRlQ29tcGxldGUoKSB7XG4gICAgcmV0dXJuIHRoaXMuaXNVcGRhdGVDb21wbGV0ZSgpO1xuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIGlzVXBkYXRlQ29tcGxldGUoKSB7XG4gICAgY29uc3Qgc3RhdHVzID0gYXdhaXQgdGhpcy5xdWVyeVN0YXR1cygpO1xuICAgIHJldHVybiB7XG4gICAgICBJc0NvbXBsZXRlOiBzdGF0dXMgPT09ICdBQ1RJVkUnLFxuICAgIH07XG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgaXNEZWxldGVDb21wbGV0ZSgpIHtcbiAgICBjb25zdCBzdGF0dXMgPSBhd2FpdCB0aGlzLnF1ZXJ5U3RhdHVzKCk7XG4gICAgcmV0dXJuIHtcbiAgICAgIElzQ29tcGxldGU6IHN0YXR1cyA9PT0gJ05PVF9GT1VORCcsXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZW5lcmF0ZXMgYSBmYXJnYXRlIHByb2ZpbGUgbmFtZS5cbiAgICovXG4gIHByaXZhdGUgZ2VuZXJhdGVQcm9maWxlTmFtZSgpIHtcbiAgICBjb25zdCBzdWZmaXggPSB0aGlzLnJlcXVlc3RJZC5yZXBsYWNlKC8tL2csICcnKTsgLy8gMzIgY2hhcnNcbiAgICBjb25zdCBwcmVmaXggPSB0aGlzLmxvZ2ljYWxSZXNvdXJjZUlkLnN1YnN0cigwLCBNQVhfTkFNRV9MRU4gLSBzdWZmaXgubGVuZ3RoIC0gMSk7XG4gICAgcmV0dXJuIGAke3ByZWZpeH0tJHtzdWZmaXh9YDtcbiAgfVxuXG4gIC8qKlxuICAgKiBRdWVyaWVzIHRoZSBGYXJnYXRlIHByb2ZpbGUncyBjdXJyZW50IHN0YXR1cyBhbmQgcmV0dXJucyB0aGUgc3RhdHVzIG9yXG4gICAqIE5PVF9GT1VORCBpZiB0aGUgcHJvZmlsZSBkb2Vzbid0IGV4aXN0IChpLmUuIGl0IGhhcyBiZWVuIGRlbGV0ZWQpLlxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBxdWVyeVN0YXR1cygpOiBQcm9taXNlPGF3cy5FS1MuRmFyZ2F0ZVByb2ZpbGVTdGF0dXMgfCAnTk9UX0ZPVU5EJyB8IHVuZGVmaW5lZD4ge1xuICAgIGlmICghdGhpcy5waHlzaWNhbFJlc291cmNlSWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5hYmxlIHRvIGRldGVybWluZSBzdGF0dXMgZm9yIGZhcmdhdGUgcHJvZmlsZSB3aXRob3V0IGEgcmVzb3VyY2UgbmFtZScpO1xuICAgIH1cblxuICAgIGNvbnN0IGRlc2NyaWJlRmFyZ2F0ZVByb2ZpbGU6IGF3cy5FS1MuRGVzY3JpYmVGYXJnYXRlUHJvZmlsZVJlcXVlc3QgPSB7XG4gICAgICBjbHVzdGVyTmFtZTogdGhpcy5ldmVudC5SZXNvdXJjZVByb3BlcnRpZXMuQ29uZmlnLmNsdXN0ZXJOYW1lLFxuICAgICAgZmFyZ2F0ZVByb2ZpbGVOYW1lOiB0aGlzLnBoeXNpY2FsUmVzb3VyY2VJZCxcbiAgICB9O1xuXG4gICAgdHJ5IHtcblxuICAgICAgdGhpcy5sb2coeyBkZXNjcmliZUZhcmdhdGVQcm9maWxlIH0pO1xuICAgICAgY29uc3QgZGVzY3JpYmVGYXJnYXRlUHJvZmlsZVJlc3BvbnNlID0gYXdhaXQgdGhpcy5la3MuZGVzY3JpYmVGYXJnYXRlUHJvZmlsZShkZXNjcmliZUZhcmdhdGVQcm9maWxlKTtcbiAgICAgIHRoaXMubG9nKHsgZGVzY3JpYmVGYXJnYXRlUHJvZmlsZVJlc3BvbnNlIH0pO1xuICAgICAgY29uc3Qgc3RhdHVzID0gZGVzY3JpYmVGYXJnYXRlUHJvZmlsZVJlc3BvbnNlLmZhcmdhdGVQcm9maWxlPy5zdGF0dXM7XG5cbiAgICAgIGlmIChzdGF0dXMgPT09ICdDUkVBVEVfRkFJTEVEJyB8fCBzdGF0dXMgPT09ICdERUxFVEVfRkFJTEVEJykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3Ioc3RhdHVzKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHN0YXR1cztcbiAgICB9IGNhdGNoIChkZXNjcmliZUZhcmdhdGVQcm9maWxlRXJyb3IpIHtcbiAgICAgIGlmIChkZXNjcmliZUZhcmdhdGVQcm9maWxlRXJyb3IuY29kZSA9PT0gJ1Jlc291cmNlTm90Rm91bmRFeGNlcHRpb24nKSB7XG4gICAgICAgIHRoaXMubG9nKCdyZWNlaXZlZCBSZXNvdXJjZU5vdEZvdW5kRXhjZXB0aW9uLCB0aGlzIG1lYW5zIHRoZSBwcm9maWxlIGhhcyBiZWVuIGRlbGV0ZWQgKG9yIG5ldmVyIGV4aXN0ZWQpJyk7XG4gICAgICAgIHJldHVybiAnTk9UX0ZPVU5EJztcbiAgICAgIH1cblxuICAgICAgdGhpcy5sb2coeyBkZXNjcmliZUZhcmdhdGVQcm9maWxlRXJyb3IgfSk7XG4gICAgICB0aHJvdyBkZXNjcmliZUZhcmdhdGVQcm9maWxlRXJyb3I7XG4gICAgfVxuICB9XG59Il19