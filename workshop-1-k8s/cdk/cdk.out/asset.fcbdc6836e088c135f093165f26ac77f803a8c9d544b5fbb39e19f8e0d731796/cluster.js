"use strict";
// tslint:disable:no-console
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClusterResourceHandler = void 0;
const common_1 = require("./common");
const MAX_CLUSTER_NAME_LEN = 100;
class ClusterResourceHandler extends common_1.ResourceHandler {
    constructor(eks, event) {
        super(eks, event);
        this.newProps = parseProps(this.event.ResourceProperties);
        this.oldProps = event.RequestType === 'Update' ? parseProps(event.OldResourceProperties) : {};
    }
    get clusterName() {
        if (!this.physicalResourceId) {
            throw new Error('Cannot determine cluster name without physical resource ID');
        }
        return this.physicalResourceId;
    }
    // ------
    // CREATE
    // ------
    async onCreate() {
        console.log('onCreate: creating cluster with options:', JSON.stringify(this.newProps, undefined, 2));
        if (!this.newProps.roleArn) {
            throw new Error('"roleArn" is required');
        }
        const clusterName = this.newProps.name || this.generateClusterName();
        const resp = await this.eks.createCluster({
            ...this.newProps,
            name: clusterName,
        });
        if (!resp.cluster) {
            throw new Error(`Error when trying to create cluster ${clusterName}: CreateCluster returned without cluster information`);
        }
        return {
            PhysicalResourceId: resp.cluster.name,
        };
    }
    async isCreateComplete() {
        return this.isActive();
    }
    // ------
    // DELETE
    // ------
    async onDelete() {
        console.log(`onDelete: deleting cluster ${this.clusterName}`);
        try {
            await this.eks.deleteCluster({ name: this.clusterName });
        }
        catch (e) {
            if (e.code !== 'ResourceNotFoundException') {
                throw e;
            }
            else {
                console.log(`cluster ${this.clusterName} not found, idempotently succeeded`);
            }
        }
        return {
            PhysicalResourceId: this.clusterName,
        };
    }
    async isDeleteComplete() {
        console.log(`isDeleteComplete: waiting for cluster ${this.clusterName} to be deleted`);
        try {
            const resp = await this.eks.describeCluster({ name: this.clusterName });
            console.log('describeCluster returned:', JSON.stringify(resp, undefined, 2));
        }
        catch (e) {
            if (e.code === 'ResourceNotFoundException') {
                console.log('received ResourceNotFoundException, this means the cluster has been deleted (or never existed)');
                return { IsComplete: true };
            }
            console.log('describeCluster error:', e);
            throw e;
        }
        return {
            IsComplete: false,
        };
    }
    // ------
    // UPDATE
    // ------
    async onUpdate() {
        var _a;
        const updates = analyzeUpdate(this.oldProps, this.newProps);
        console.log('onUpdate:', JSON.stringify({ updates }, undefined, 2));
        // if there is an update that requires replacement, go ahead and just create
        // a new cluster with the new config. The old cluster will automatically be
        // deleted by cloudformation upon success.
        if (updates.replaceName || updates.replaceRole || updates.replaceVpc) {
            // if we are replacing this cluster and the cluster has an explicit
            // physical name, the creation of the new cluster will fail with "there is
            // already a cluster with that name". this is a common behavior for
            // CloudFormation resources that support specifying a physical name.
            if (this.oldProps.name === this.newProps.name && this.oldProps.name) {
                throw new Error(`Cannot replace cluster "${this.oldProps.name}" since it has an explicit physical name. Either rename the cluster or remove the "name" configuration`);
            }
            return await this.onCreate();
        }
        // if a version update is required, issue the version update
        if (updates.updateVersion) {
            if (!this.newProps.version) {
                throw new Error(`Cannot remove cluster version configuration. Current version is ${this.oldProps.version}`);
            }
            return await this.updateClusterVersion(this.newProps.version);
        }
        if (updates.updateLogging || updates.updateAccess) {
            const config = {
                name: this.clusterName,
                logging: this.newProps.logging,
            };
            if (updates.updateAccess) {
                // Updating the cluster with securityGroupIds and subnetIds (as specified in the warning here:
                // https://awscli.amazonaws.com/v2/documentation/api/latest/reference/eks/update-cluster-config.html)
                // will fail, therefore we take only the access fields explicitly
                config.resourcesVpcConfig = {
                    endpointPrivateAccess: this.newProps.resourcesVpcConfig.endpointPrivateAccess,
                    endpointPublicAccess: this.newProps.resourcesVpcConfig.endpointPublicAccess,
                    publicAccessCidrs: this.newProps.resourcesVpcConfig.publicAccessCidrs,
                };
            }
            const updateResponse = await this.eks.updateClusterConfig(config);
            return { EksUpdateId: (_a = updateResponse.update) === null || _a === void 0 ? void 0 : _a.id };
        }
        // no updates
        return;
    }
    async isUpdateComplete() {
        console.log('isUpdateComplete');
        // if this is an EKS update, we will monitor the update event itself
        if (this.event.EksUpdateId) {
            const complete = await this.isEksUpdateComplete(this.event.EksUpdateId);
            if (!complete) {
                return { IsComplete: false };
            }
            // fall through: if the update is done, we simply delegate to isActive()
            // in order to extract attributes and state from the cluster itself, which
            // is supposed to be in an ACTIVE state after the update is complete.
        }
        return this.isActive();
    }
    async updateClusterVersion(newVersion) {
        var _a;
        console.log(`updating cluster version to ${newVersion}`);
        // update-cluster-version will fail if we try to update to the same version,
        // so skip in this case.
        const cluster = (await this.eks.describeCluster({ name: this.clusterName })).cluster;
        if ((cluster === null || cluster === void 0 ? void 0 : cluster.version) === newVersion) {
            console.log(`cluster already at version ${cluster.version}, skipping version update`);
            return;
        }
        const updateResponse = await this.eks.updateClusterVersion({ name: this.clusterName, version: newVersion });
        return { EksUpdateId: (_a = updateResponse.update) === null || _a === void 0 ? void 0 : _a.id };
    }
    async isActive() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
        console.log('waiting for cluster to become ACTIVE');
        const resp = await this.eks.describeCluster({ name: this.clusterName });
        console.log('describeCluster result:', JSON.stringify(resp, undefined, 2));
        const cluster = resp.cluster;
        // if cluster is undefined (shouldnt happen) or status is not ACTIVE, we are
        // not complete. note that the custom resource provider framework forbids
        // returning attributes (Data) if isComplete is false.
        if ((cluster === null || cluster === void 0 ? void 0 : cluster.status) !== 'ACTIVE') {
            return {
                IsComplete: false,
            };
        }
        else {
            return {
                IsComplete: true,
                Data: {
                    Name: cluster.name,
                    Endpoint: cluster.endpoint,
                    Arn: cluster.arn,
                    // IMPORTANT: CFN expects that attributes will *always* have values,
                    // so return an empty string in case the value is not defined.
                    // Otherwise, CFN will throw with `Vendor response doesn't contain
                    // XXXX key`.
                    CertificateAuthorityData: (_b = (_a = cluster.certificateAuthority) === null || _a === void 0 ? void 0 : _a.data) !== null && _b !== void 0 ? _b : '',
                    ClusterSecurityGroupId: (_d = (_c = cluster.resourcesVpcConfig) === null || _c === void 0 ? void 0 : _c.clusterSecurityGroupId) !== null && _d !== void 0 ? _d : '',
                    OpenIdConnectIssuerUrl: (_g = (_f = (_e = cluster.identity) === null || _e === void 0 ? void 0 : _e.oidc) === null || _f === void 0 ? void 0 : _f.issuer) !== null && _g !== void 0 ? _g : '',
                    OpenIdConnectIssuer: (_l = (_k = (_j = (_h = cluster.identity) === null || _h === void 0 ? void 0 : _h.oidc) === null || _j === void 0 ? void 0 : _j.issuer) === null || _k === void 0 ? void 0 : _k.substring(8)) !== null && _l !== void 0 ? _l : '',
                    // We can safely return the first item from encryption configuration array, because it has a limit of 1 item
                    // https://docs.aws.amazon.com/eks/latest/APIReference/API_CreateCluster.html#AmazonEKS-CreateCluster-request-encryptionConfig
                    EncryptionConfigKeyArn: (_q = (_p = (_o = (_m = cluster.encryptionConfig) === null || _m === void 0 ? void 0 : _m.shift()) === null || _o === void 0 ? void 0 : _o.provider) === null || _p === void 0 ? void 0 : _p.keyArn) !== null && _q !== void 0 ? _q : '',
                },
            };
        }
    }
    async isEksUpdateComplete(eksUpdateId) {
        this.log({ isEksUpdateComplete: eksUpdateId });
        const describeUpdateResponse = await this.eks.describeUpdate({
            name: this.clusterName,
            updateId: eksUpdateId,
        });
        this.log({ describeUpdateResponse });
        if (!describeUpdateResponse.update) {
            throw new Error(`unable to describe update with id "${eksUpdateId}"`);
        }
        switch (describeUpdateResponse.update.status) {
            case 'InProgress':
                return false;
            case 'Successful':
                return true;
            case 'Failed':
            case 'Cancelled':
                throw new Error(`cluster update id "${eksUpdateId}" failed with errors: ${JSON.stringify(describeUpdateResponse.update.errors)}`);
            default:
                throw new Error(`unknown status "${describeUpdateResponse.update.status}" for update id "${eksUpdateId}"`);
        }
    }
    generateClusterName() {
        const suffix = this.requestId.replace(/-/g, ''); // 32 chars
        const prefix = this.logicalResourceId.substr(0, MAX_CLUSTER_NAME_LEN - suffix.length - 1);
        return `${prefix}-${suffix}`;
    }
}
exports.ClusterResourceHandler = ClusterResourceHandler;
function parseProps(props) {
    var _a;
    return (_a = props === null || props === void 0 ? void 0 : props.Config) !== null && _a !== void 0 ? _a : {};
}
function analyzeUpdate(oldProps, newProps) {
    console.log('old props: ', JSON.stringify(oldProps));
    console.log('new props: ', JSON.stringify(newProps));
    const newVpcProps = newProps.resourcesVpcConfig || {};
    const oldVpcProps = oldProps.resourcesVpcConfig || {};
    return {
        replaceName: newProps.name !== oldProps.name,
        replaceVpc: JSON.stringify(newVpcProps.subnetIds) !== JSON.stringify(oldVpcProps.subnetIds) ||
            JSON.stringify(newVpcProps.securityGroupIds) !== JSON.stringify(oldVpcProps.securityGroupIds),
        updateAccess: newVpcProps.endpointPrivateAccess !== oldVpcProps.endpointPrivateAccess ||
            newVpcProps.endpointPublicAccess !== oldVpcProps.endpointPublicAccess,
        replaceRole: newProps.roleArn !== oldProps.roleArn,
        updateVersion: newProps.version !== oldProps.version,
        updateLogging: JSON.stringify(newProps.logging) !== JSON.stringify(oldProps.logging),
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2x1c3Rlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNsdXN0ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLDRCQUE0Qjs7O0FBSzVCLHFDQUFxRTtBQUVyRSxNQUFNLG9CQUFvQixHQUFHLEdBQUcsQ0FBQztBQUVqQyxNQUFhLHNCQUF1QixTQUFRLHdCQUFlO0lBWXpELFlBQVksR0FBYyxFQUFFLEtBQW9CO1FBQzlDLEtBQUssQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFbEIsSUFBSSxDQUFDLFFBQVEsR0FBRyxVQUFVLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1FBQzFELElBQUksQ0FBQyxRQUFRLEdBQUcsS0FBSyxDQUFDLFdBQVcsS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMscUJBQXFCLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRyxDQUFDO0lBQ2pHLENBQUM7SUFoQkQsSUFBVyxXQUFXO1FBQ3BCLElBQUksQ0FBQyxJQUFJLENBQUMsa0JBQWtCLEVBQUU7WUFDNUIsTUFBTSxJQUFJLEtBQUssQ0FBQyw0REFBNEQsQ0FBQyxDQUFDO1NBQy9FO1FBRUQsT0FBTyxJQUFJLENBQUMsa0JBQWtCLENBQUM7SUFDakMsQ0FBQztJQVlELFNBQVM7SUFDVCxTQUFTO0lBQ1QsU0FBUztJQUVDLEtBQUssQ0FBQyxRQUFRO1FBQ3RCLE9BQU8sQ0FBQyxHQUFHLENBQUMsMENBQTBDLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3JHLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFBRTtZQUMxQixNQUFNLElBQUksS0FBSyxDQUFDLHVCQUF1QixDQUFDLENBQUM7U0FDMUM7UUFFRCxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFD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RCxNQUFNLFdBQVcsR0FBRyxRQUFRLENBQUMsa0JBQWtCLElBQUksRUFBRyxDQUFDO0lBRXZELE9BQU87UUFDTCxXQUFXLEVBQUUsUUFBUSxDQUFDLElBQUksS0FBSyxRQUFRLENBQUMsSUFBSTtRQUM1QyxVQUFVLEVBQ1IsSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLEtBQUssSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDO1lBQy9FLElBQUksQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLGdCQUFnQixDQUFDLEtBQUssSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsZ0JBQWdCLENBQUM7UUFDL0YsWUFBWSxFQUNWLFdBQVcsQ0FBQyxxQkFBcUIsS0FBSyxXQUFXLENBQUMscUJBQXFCO1lBQ3ZFLFdBQVcsQ0FBQyxvQkFBb0IsS0FBSyxXQUFXLENBQUMsb0JBQW9CO1FBQ3ZFLFdBQVcsRUFBRSxRQUFRLENBQUMsT0FBTyxLQUFLLFFBQVEsQ0FBQyxPQUFPO1FBQ2xELGFBQWEsRUFBRSxRQUFRLENBQUMsT0FBTyxLQUFLLFFBQVEsQ0FBQyxPQUFPO1FBQ3BELGFBQWEsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsS0FBSyxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUM7S0FDckYsQ0FBQztBQUNKLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvLyB0c2xpbnQ6ZGlzYWJsZTpuby1jb25zb2xlXG5cbmltcG9ydCB7IElzQ29tcGxldGVSZXNwb25zZSwgT25FdmVudFJlc3BvbnNlIH0gZnJvbSAnQGF3cy1jZGsvY3VzdG9tLXJlc291cmNlcy9saWIvcHJvdmlkZXItZnJhbWV3b3JrL3R5cGVzJztcbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBpbXBvcnQvbm8tZXh0cmFuZW91cy1kZXBlbmRlbmNpZXNcbmltcG9ydCAqIGFzIGF3cyBmcm9tICdhd3Mtc2RrJztcbmltcG9ydCB7IEVrc0NsaWVudCwgUmVzb3VyY2VFdmVudCwgUmVzb3VyY2VIYW5kbGVyIH0gZnJvbSAnLi9jb21tb24nO1xuXG5jb25zdCBNQVhfQ0xVU1RFUl9OQU1FX0xFTiA9IDEwMDtcblxuZXhwb3J0IGNsYXNzIENsdXN0ZXJSZXNvdXJjZUhhbmRsZXIgZXh0ZW5kcyBSZXNvdXJjZUhhbmRsZXIge1xuICBwdWJsaWMgZ2V0IGNsdXN0ZXJOYW1lKCkge1xuICAgIGlmICghdGhpcy5waHlzaWNhbFJlc291cmNlSWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ2Fubm90IGRldGVybWluZSBjbHVzdGVyIG5hbWUgd2l0aG91dCBwaHlzaWNhbCByZXNvdXJjZSBJRCcpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLnBoeXNpY2FsUmVzb3VyY2VJZDtcbiAgfVxuXG4gIHByaXZhdGUgcmVhZG9ubHkgbmV3UHJvcHM6IGF3cy5FS1MuQ3JlYXRlQ2x1c3RlclJlcXVlc3Q7XG4gIHByaXZhdGUgcmVhZG9ubHkgb2xkUHJvcHM6IFBhcnRpYWw8YXdzLkVLUy5DcmVhdGVDbHVzdGVyUmVxdWVzdD47XG5cbiAgY29uc3RydWN0b3IoZWtzOiBFa3NDbGllbnQsIGV2ZW50OiBSZXNvdXJjZUV2ZW50KSB7XG4gICAgc3VwZXIoZWtzLCBldmVudCk7XG5cbiAgICB0aGlzLm5ld1Byb3BzID0gcGFyc2VQcm9wcyh0aGlzLmV2ZW50LlJlc291cmNlUHJvcGVydGllcyk7XG4gICAgdGhpcy5vbGRQcm9wcyA9IGV2ZW50LlJlcXVlc3RUeXBlID09PSAnVXBkYXRlJyA/IHBhcnNlUHJvcHMoZXZlbnQuT2xkUmVzb3VyY2VQcm9wZXJ0aWVzKSA6IHsgfTtcbiAgfVxuXG4gIC8vIC0tLS0tLVxuICAvLyBDUkVBVEVcbiAgLy8gLS0tLS0tXG5cbiAgcHJvdGVjdGVkIGFzeW5jIG9uQ3JlYXRlKCk6IFByb21pc2U8T25FdmVudFJlc3BvbnNlPiB7XG4gICAgY29uc29sZS5sb2coJ29uQ3JlYXRlOiBjcmVhdGluZyBjbHVzdGVyIHdpdGggb3B0aW9uczonLCBKU09OLnN0cmluZ2lmeSh0aGlzLm5ld1Byb3BzLCB1bmRlZmluZWQsIDIpKTtcbiAgICBpZiAoIXRoaXMubmV3UHJvcHMucm9sZUFybikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdcInJvbGVBcm5cIiBpcyByZXF1aXJlZCcpO1xuICAgIH1cblxuICAgIGNvbnN0IGNsdXN0ZXJOYW1lID0gdGhpcy5uZXdQcm9wcy5uYW1lIHx8IHRoaXMuZ2VuZXJhdGVDbHVzdGVyTmFtZSgpO1xuXG4gICAgY29uc3QgcmVzcCA9IGF3YWl0IHRoaXMuZWtzLmNyZWF0ZUNsdXN0ZXIoe1xuICAgICAgLi4udGhpcy5uZXdQcm9wcyxcbiAgICAgIG5hbWU6IGNsdXN0ZXJOYW1lLFxuICAgIH0pO1xuXG4gICAgaWYgKCFyZXNwLmNsdXN0ZXIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRXJyb3Igd2hlbiB0cnlpbmcgdG8gY3JlYXRlIGNsdXN0ZXIgJHtjbHVzdGVyTmFtZX06IENyZWF0ZUNsdXN0ZXIgcmV0dXJuZWQgd2l0aG91dCBjbHVzdGVyIGluZm9ybWF0aW9uYCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIFBoeXNpY2FsUmVzb3VyY2VJZDogcmVzcC5jbHVzdGVyLm5hbWUsXG4gICAgfTtcbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBpc0NyZWF0ZUNvbXBsZXRlKCkge1xuICAgIHJldHVybiB0aGlzLmlzQWN0aXZlKCk7XG4gIH1cblxuICAvLyAtLS0tLS1cbiAgLy8gREVMRVRFXG4gIC8vIC0tLS0tLVxuXG4gIHByb3RlY3RlZCBhc3luYyBvbkRlbGV0ZSgpOiBQcm9taXNlPE9uRXZlbnRSZXNwb25zZT4ge1xuICAgIGNvbnNvbGUubG9nKGBvbkRlbGV0ZTogZGVsZXRpbmcgY2x1c3RlciAke3RoaXMuY2x1c3Rlck5hbWV9YCk7XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHRoaXMuZWtzLmRlbGV0ZUNsdXN0ZXIoeyBuYW1lOiB0aGlzLmNsdXN0ZXJOYW1lIH0pO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGlmIChlLmNvZGUgIT09ICdSZXNvdXJjZU5vdEZvdW5kRXhjZXB0aW9uJykge1xuICAgICAgICB0aHJvdyBlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5sb2coYGNsdXN0ZXIgJHt0aGlzLmNsdXN0ZXJOYW1lfSBub3QgZm91bmQsIGlkZW1wb3RlbnRseSBzdWNjZWVkZWRgKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIFBoeXNpY2FsUmVzb3VyY2VJZDogdGhpcy5jbHVzdGVyTmFtZSxcbiAgICB9O1xuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIGlzRGVsZXRlQ29tcGxldGUoKTogUHJvbWlzZTxJc0NvbXBsZXRlUmVzcG9uc2U+IHtcbiAgICBjb25zb2xlLmxvZyhgaXNEZWxldGVDb21wbGV0ZTogd2FpdGluZyBmb3IgY2x1c3RlciAke3RoaXMuY2x1c3Rlck5hbWV9IHRvIGJlIGRlbGV0ZWRgKTtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXNwID0gYXdhaXQgdGhpcy5la3MuZGVzY3JpYmVDbHVzdGVyKHsgbmFtZTogdGhpcy5jbHVzdGVyTmFtZSB9KTtcbiAgICAgIGNvbnNvbGUubG9nKCdkZXNjcmliZUNsdXN0ZXIgcmV0dXJuZWQ6JywgSlNPTi5zdHJpbmdpZnkocmVzcCwgdW5kZWZpbmVkLCAyKSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgaWYgKGUuY29kZSA9PT0gJ1Jlc291cmNlTm90Rm91bmRFeGNlcHRpb24nKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdyZWNlaXZlZCBSZXNvdXJjZU5vdEZvdW5kRXhjZXB0aW9uLCB0aGlzIG1lYW5zIHRoZSBjbHVzdGVyIGhhcyBiZWVuIGRlbGV0ZWQgKG9yIG5ldmVyIGV4aXN0ZWQpJyk7XG4gICAgICAgIHJldHVybiB7IElzQ29tcGxldGU6IHRydWUgfTtcbiAgICAgIH1cblxuICAgICAgY29uc29sZS5sb2coJ2Rlc2NyaWJlQ2x1c3RlciBlcnJvcjonLCBlKTtcbiAgICAgIHRocm93IGU7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIElzQ29tcGxldGU6IGZhbHNlLFxuICAgIH07XG4gIH1cblxuICAvLyAtLS0tLS1cbiAgLy8gVVBEQVRFXG4gIC8vIC0tLS0tLVxuXG4gIHByb3RlY3RlZCBhc3luYyBvblVwZGF0ZSgpIHtcbiAgICBjb25zdCB1cGRhdGVzID0gYW5hbHl6ZVVwZGF0ZSh0aGlzLm9sZFByb3BzLCB0aGlzLm5ld1Byb3BzKTtcbiAgICBjb25zb2xlLmxvZygnb25VcGRhdGU6JywgSlNPTi5zdHJpbmdpZnkoeyB1cGRhdGVzIH0sIHVuZGVmaW5lZCwgMikpO1xuXG4gICAgLy8gaWYgdGhlcmUgaXMgYW4gdXBkYXRlIHRoYXQgcmVxdWlyZXMgcmVwbGFjZW1lbnQsIGdvIGFoZWFkIGFuZCBqdXN0IGNyZWF0ZVxuICAgIC8vIGEgbmV3IGNsdXN0ZXIgd2l0aCB0aGUgbmV3IGNvbmZpZy4gVGhlIG9sZCBjbHVzdGVyIHdpbGwgYXV0b21hdGljYWxseSBiZVxuICAgIC8vIGRlbGV0ZWQgYnkgY2xvdWRmb3JtYXRpb24gdXBvbiBzdWNjZXNzLlxuICAgIGlmICh1cGRhdGVzLnJlcGxhY2VOYW1lIHx8IHVwZGF0ZXMucmVwbGFjZVJvbGUgfHwgdXBkYXRlcy5yZXBsYWNlVnBjKSB7XG5cbiAgICAgIC8vIGlmIHdlIGFyZSByZXBsYWNpbmcgdGhpcyBjbHVzdGVyIGFuZCB0aGUgY2x1c3RlciBoYXMgYW4gZXhwbGljaXRcbiAgICAgIC8vIHBoeXNpY2FsIG5hbWUsIHRoZSBjcmVhdGlvbiBvZiB0aGUgbmV3IGNsdXN0ZXIgd2lsbCBmYWlsIHdpdGggXCJ0aGVyZSBpc1xuICAgICAgLy8gYWxyZWFkeSBhIGNsdXN0ZXIgd2l0aCB0aGF0IG5hbWVcIi4gdGhpcyBpcyBhIGNvbW1vbiBiZWhhdmlvciBmb3JcbiAgICAgIC8vIENsb3VkRm9ybWF0aW9uIHJlc291cmNlcyB0aGF0IHN1cHBvcnQgc3BlY2lmeWluZyBhIHBoeXNpY2FsIG5hbWUuXG4gICAgICBpZiAodGhpcy5vbGRQcm9wcy5uYW1lID09PSB0aGlzLm5ld1Byb3BzLm5hbWUgJiYgdGhpcy5vbGRQcm9wcy5uYW1lKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQ2Fubm90IHJlcGxhY2UgY2x1c3RlciBcIiR7dGhpcy5vbGRQcm9wcy5uYW1lfVwiIHNpbmNlIGl0IGhhcyBhbiBleHBsaWNpdCBwaHlzaWNhbCBuYW1lLiBFaXRoZXIgcmVuYW1lIHRoZSBjbHVzdGVyIG9yIHJlbW92ZSB0aGUgXCJuYW1lXCIgY29uZmlndXJhdGlvbmApO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gYXdhaXQgdGhpcy5vbkNyZWF0ZSgpO1xuICAgIH1cblxuICAgIC8vIGlmIGEgdmVyc2lvbiB1cGRhdGUgaXMgcmVxdWlyZWQsIGlzc3VlIHRoZSB2ZXJzaW9uIHVwZGF0ZVxuICAgIGlmICh1cGRhdGVzLnVwZGF0ZVZlcnNpb24pIHtcbiAgICAgIGlmICghdGhpcy5uZXdQcm9wcy52ZXJzaW9uKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQ2Fubm90IHJlbW92ZSBjbHVzdGVyIHZlcnNpb24gY29uZmlndXJhdGlvbi4gQ3VycmVudCB2ZXJzaW9uIGlzICR7dGhpcy5vbGRQcm9wcy52ZXJzaW9ufWApO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gYXdhaXQgdGhpcy51cGRhdGVDbHVzdGVyVmVyc2lvbih0aGlzLm5ld1Byb3BzLnZlcnNpb24pO1xuICAgIH1cblxuICAgIGlmICh1cGRhdGVzLnVwZGF0ZUxvZ2dpbmcgfHwgdXBkYXRlcy51cGRhdGVBY2Nlc3MpIHtcbiAgICAgIGNvbnN0IGNvbmZpZzogYXdzLkVLUy5VcGRhdGVDbHVzdGVyQ29uZmlnUmVxdWVzdCA9IHtcbiAgICAgICAgbmFtZTogdGhpcy5jbHVzdGVyTmFtZSxcbiAgICAgICAgbG9nZ2luZzogdGhpcy5uZXdQcm9wcy5sb2dnaW5nLFxuICAgICAgfTtcbiAgICAgIGlmICh1cGRhdGVzLnVwZGF0ZUFjY2Vzcykge1xuICAgICAgICAvLyBVcGRhdGluZyB0aGUgY2x1c3RlciB3aXRoIHNlY3VyaXR5R3JvdXBJZHMgYW5kIHN1Ym5ldElkcyAoYXMgc3BlY2lmaWVkIGluIHRoZSB3YXJuaW5nIGhlcmU6XG4gICAgICAgIC8vIGh0dHBzOi8vYXdzY2xpLmFtYXpvbmF3cy5jb20vdjIvZG9jdW1lbnRhdGlvbi9hcGkvbGF0ZXN0L3JlZmVyZW5jZS9la3MvdXBkYXRlLWNsdXN0ZXItY29uZmlnLmh0bWwpXG4gICAgICAgIC8vIHdpbGwgZmFpbCwgdGhlcmVmb3JlIHdlIHRha2Ugb25seSB0aGUgYWNjZXNzIGZpZWxkcyBleHBsaWNpdGx5XG4gICAgICAgIGNvbmZpZy5yZXNvdXJjZXNWcGNDb25maWcgPSB7XG4gICAgICAgICAgZW5kcG9pbnRQcml2YXRlQWNjZXNzOiB0aGlzLm5ld1Byb3BzLnJlc291cmNlc1ZwY0NvbmZpZy5lbmRwb2ludFByaXZhdGVBY2Nlc3MsXG4gICAgICAgICAgZW5kcG9pbnRQdWJsaWNBY2Nlc3M6IHRoaXMubmV3UHJvcHMucmVzb3VyY2VzVnBjQ29uZmlnLmVuZHBvaW50UHVibGljQWNjZXNzLFxuICAgICAgICAgIHB1YmxpY0FjY2Vzc0NpZHJzOiB0aGlzLm5ld1Byb3BzLnJlc291cmNlc1ZwY0NvbmZpZy5wdWJsaWNBY2Nlc3NDaWRycyxcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHVwZGF0ZVJlc3BvbnNlID0gYXdhaXQgdGhpcy5la3MudXBkYXRlQ2x1c3RlckNvbmZpZyhjb25maWcpO1xuXG4gICAgICByZXR1cm4geyBFa3NVcGRhdGVJZDogdXBkYXRlUmVzcG9uc2UudXBkYXRlPy5pZCB9O1xuICAgIH1cblxuICAgIC8vIG5vIHVwZGF0ZXNcbiAgICByZXR1cm47XG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgaXNVcGRhdGVDb21wbGV0ZSgpIHtcbiAgICBjb25zb2xlLmxvZygnaXNVcGRhdGVDb21wbGV0ZScpO1xuXG4gICAgLy8gaWYgdGhpcyBpcyBhbiBFS1MgdXBkYXRlLCB3ZSB3aWxsIG1vbml0b3IgdGhlIHVwZGF0ZSBldmVudCBpdHNlbGZcbiAgICBpZiAodGhpcy5ldmVudC5Fa3NVcGRhdGVJZCkge1xuICAgICAgY29uc3QgY29tcGxldGUgPSBhd2FpdCB0aGlzLmlzRWtzVXBkYXRlQ29tcGxldGUodGhpcy5ldmVudC5Fa3NVcGRhdGVJZCk7XG4gICAgICBpZiAoIWNvbXBsZXRlKSB7XG4gICAgICAgIHJldHVybiB7IElzQ29tcGxldGU6IGZhbHNlIH07XG4gICAgICB9XG5cbiAgICAgIC8vIGZhbGwgdGhyb3VnaDogaWYgdGhlIHVwZGF0ZSBpcyBkb25lLCB3ZSBzaW1wbHkgZGVsZWdhdGUgdG8gaXNBY3RpdmUoKVxuICAgICAgLy8gaW4gb3JkZXIgdG8gZXh0cmFjdCBhdHRyaWJ1dGVzIGFuZCBzdGF0ZSBmcm9tIHRoZSBjbHVzdGVyIGl0c2VsZiwgd2hpY2hcbiAgICAgIC8vIGlzIHN1cHBvc2VkIHRvIGJlIGluIGFuIEFDVElWRSBzdGF0ZSBhZnRlciB0aGUgdXBkYXRlIGlzIGNvbXBsZXRlLlxuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmlzQWN0aXZlKCk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHVwZGF0ZUNsdXN0ZXJWZXJzaW9uKG5ld1ZlcnNpb246IHN0cmluZykge1xuICAgIGNvbnNvbGUubG9nKGB1cGRhdGluZyBjbHVzdGVyIHZlcnNpb24gdG8gJHtuZXdWZXJzaW9ufWApO1xuXG4gICAgLy8gdXBkYXRlLWNsdXN0ZXItdmVyc2lvbiB3aWxsIGZhaWwgaWYgd2UgdHJ5IHRvIHVwZGF0ZSB0byB0aGUgc2FtZSB2ZXJzaW9uLFxuICAgIC8vIHNvIHNraXAgaW4gdGhpcyBjYXNlLlxuICAgIGNvbnN0IGNsdXN0ZXIgPSAoYXdhaXQgdGhpcy5la3MuZGVzY3JpYmVDbHVzdGVyKHsgbmFtZTogdGhpcy5jbHVzdGVyTmFtZSB9KSkuY2x1c3RlcjtcbiAgICBpZiAoY2x1c3Rlcj8udmVyc2lvbiA9PT0gbmV3VmVyc2lvbikge1xuICAgICAgY29uc29sZS5sb2coYGNsdXN0ZXIgYWxyZWFkeSBhdCB2ZXJzaW9uICR7Y2x1c3Rlci52ZXJzaW9ufSwgc2tpcHBpbmcgdmVyc2lvbiB1cGRhdGVgKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCB1cGRhdGVSZXNwb25zZSA9IGF3YWl0IHRoaXMuZWtzLnVwZGF0ZUNsdXN0ZXJWZXJzaW9uKHsgbmFtZTogdGhpcy5jbHVzdGVyTmFtZSwgdmVyc2lvbjogbmV3VmVyc2lvbiB9KTtcbiAgICByZXR1cm4geyBFa3NVcGRhdGVJZDogdXBkYXRlUmVzcG9uc2UudXBkYXRlPy5pZCB9O1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBpc0FjdGl2ZSgpOiBQcm9taXNlPElzQ29tcGxldGVSZXNwb25zZT4ge1xuICAgIGNvbnNvbGUubG9nKCd3YWl0aW5nIGZvciBjbHVzdGVyIHRvIGJlY29tZSBBQ1RJVkUnKTtcbiAgICBjb25zdCByZXNwID0gYXdhaXQgdGhpcy5la3MuZGVzY3JpYmVDbHVzdGVyKHsgbmFtZTogdGhpcy5jbHVzdGVyTmFtZSB9KTtcbiAgICBjb25zb2xlLmxvZygnZGVzY3JpYmVDbHVzdGVyIHJlc3VsdDonLCBKU09OLnN0cmluZ2lmeShyZXNwLCB1bmRlZmluZWQsIDIpKTtcbiAgICBjb25zdCBjbHVzdGVyID0gcmVzcC5jbHVzdGVyO1xuXG4gICAgLy8gaWYgY2x1c3RlciBpcyB1bmRlZmluZWQgKHNob3VsZG50IGhhcHBlbikgb3Igc3RhdHVzIGlzIG5vdCBBQ1RJVkUsIHdlIGFyZVxuICAgIC8vIG5vdCBjb21wbGV0ZS4gbm90ZSB0aGF0IHRoZSBjdXN0b20gcmVzb3VyY2UgcHJvdmlkZXIgZnJhbWV3b3JrIGZvcmJpZHNcbiAgICAvLyByZXR1cm5pbmcgYXR0cmlidXRlcyAoRGF0YSkgaWYgaXNDb21wbGV0ZSBpcyBmYWxzZS5cbiAgICBpZiAoY2x1c3Rlcj8uc3RhdHVzICE9PSAnQUNUSVZFJykge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgSXNDb21wbGV0ZTogZmFsc2UsXG4gICAgICB9O1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBJc0NvbXBsZXRlOiB0cnVlLFxuICAgICAgICBEYXRhOiB7XG4gICAgICAgICAgTmFtZTogY2x1c3Rlci5uYW1lLFxuICAgICAgICAgIEVuZHBvaW50OiBjbHVzdGVyLmVuZHBvaW50LFxuICAgICAgICAgIEFybjogY2x1c3Rlci5hcm4sXG5cbiAgICAgICAgICAvLyBJTVBPUlRBTlQ6IENGTiBleHBlY3RzIHRoYXQgYXR0cmlidXRlcyB3aWxsICphbHdheXMqIGhhdmUgdmFsdWVzLFxuICAgICAgICAgIC8vIHNvIHJldHVybiBhbiBlbXB0eSBzdHJpbmcgaW4gY2FzZSB0aGUgdmFsdWUgaXMgbm90IGRlZmluZWQuXG4gICAgICAgICAgLy8gT3RoZXJ3aXNlLCBDRk4gd2lsbCB0aHJvdyB3aXRoIGBWZW5kb3IgcmVzcG9uc2UgZG9lc24ndCBjb250YWluXG4gICAgICAgICAgLy8gWFhYWCBrZXlgLlxuXG4gICAgICAgICAgQ2VydGlmaWNhdGVBdXRob3JpdHlEYXRhOiBjbHVzdGVyLmNlcnRpZmljYXRlQXV0aG9yaXR5Py5kYXRhID8/ICcnLFxuICAgICAgICAgIENsdXN0ZXJTZWN1cml0eUdyb3VwSWQ6IGNsdXN0ZXIucmVzb3VyY2VzVnBjQ29uZmlnPy5jbHVzdGVyU2VjdXJpdHlHcm91cElkID8/ICcnLFxuICAgICAgICAgIE9wZW5JZENvbm5lY3RJc3N1ZXJVcmw6IGNsdXN0ZXIuaWRlbnRpdHk/Lm9pZGM/Lmlzc3VlciA/PyAnJyxcbiAgICAgICAgICBPcGVuSWRDb25uZWN0SXNzdWVyOiBjbHVzdGVyLmlkZW50aXR5Py5vaWRjPy5pc3N1ZXI/LnN1YnN0cmluZyg4KSA/PyAnJywgLy8gU3RyaXBzIG9mZiBodHRwczovLyBmcm9tIHRoZSBpc3N1ZXIgdXJsXG5cbiAgICAgICAgICAvLyBXZSBjYW4gc2FmZWx5IHJldHVybiB0aGUgZmlyc3QgaXRlbSBmcm9tIGVuY3J5cHRpb24gY29uZmlndXJhdGlvbiBhcnJheSwgYmVjYXVzZSBpdCBoYXMgYSBsaW1pdCBvZiAxIGl0ZW1cbiAgICAgICAgICAvLyBodHRwczovL2RvY3MuYXdzLmFtYXpvbi5jb20vZWtzL2xhdGVzdC9BUElSZWZlcmVuY2UvQVBJX0NyZWF0ZUNsdXN0ZXIuaHRtbCNBbWF6b25FS1MtQ3JlYXRlQ2x1c3Rlci1yZXF1ZXN0LWVuY3J5cHRpb25Db25maWdcbiAgICAgICAgICBFbmNyeXB0aW9uQ29uZmlnS2V5QXJuOiBjbHVzdGVyLmVuY3J5cHRpb25Db25maWc/LnNoaWZ0KCk/LnByb3ZpZGVyPy5rZXlBcm4gPz8gJycsXG4gICAgICAgIH0sXG4gICAgICB9O1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgaXNFa3NVcGRhdGVDb21wbGV0ZShla3NVcGRhdGVJZDogc3RyaW5nKSB7XG4gICAgdGhpcy5sb2coeyBpc0Vrc1VwZGF0ZUNvbXBsZXRlOiBla3NVcGRhdGVJZCB9KTtcblxuICAgIGNvbnN0IGRlc2NyaWJlVXBkYXRlUmVzcG9uc2UgPSBhd2FpdCB0aGlzLmVrcy5kZXNjcmliZVVwZGF0ZSh7XG4gICAgICBuYW1lOiB0aGlzLmNsdXN0ZXJOYW1lLFxuICAgICAgdXBkYXRlSWQ6IGVrc1VwZGF0ZUlkLFxuICAgIH0pO1xuXG4gICAgdGhpcy5sb2coeyBkZXNjcmliZVVwZGF0ZVJlc3BvbnNlIH0pO1xuXG4gICAgaWYgKCFkZXNjcmliZVVwZGF0ZVJlc3BvbnNlLnVwZGF0ZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGB1bmFibGUgdG8gZGVzY3JpYmUgdXBkYXRlIHdpdGggaWQgXCIke2Vrc1VwZGF0ZUlkfVwiYCk7XG4gICAgfVxuXG4gICAgc3dpdGNoIChkZXNjcmliZVVwZGF0ZVJlc3BvbnNlLnVwZGF0ZS5zdGF0dXMpIHtcbiAgICAgIGNhc2UgJ0luUHJvZ3Jlc3MnOlxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICBjYXNlICdTdWNjZXNzZnVsJzpcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICBjYXNlICdGYWlsZWQnOlxuICAgICAgY2FzZSAnQ2FuY2VsbGVkJzpcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBjbHVzdGVyIHVwZGF0ZSBpZCBcIiR7ZWtzVXBkYXRlSWR9XCIgZmFpbGVkIHdpdGggZXJyb3JzOiAke0pTT04uc3RyaW5naWZ5KGRlc2NyaWJlVXBkYXRlUmVzcG9uc2UudXBkYXRlLmVycm9ycyl9YCk7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHVua25vd24gc3RhdHVzIFwiJHtkZXNjcmliZVVwZGF0ZVJlc3BvbnNlLnVwZGF0ZS5zdGF0dXN9XCIgZm9yIHVwZGF0ZSBpZCBcIiR7ZWtzVXBkYXRlSWR9XCJgKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGdlbmVyYXRlQ2x1c3Rlck5hbWUoKSB7XG4gICAgY29uc3Qgc3VmZml4ID0gdGhpcy5yZXF1ZXN0SWQucmVwbGFjZSgvLS9nLCAnJyk7IC8vIDMyIGNoYXJzXG4gICAgY29uc3QgcHJlZml4ID0gdGhpcy5sb2dpY2FsUmVzb3VyY2VJZC5zdWJzdHIoMCwgTUFYX0NMVVNURVJfTkFNRV9MRU4gLSBzdWZmaXgubGVuZ3RoIC0gMSk7XG4gICAgcmV0dXJuIGAke3ByZWZpeH0tJHtzdWZmaXh9YDtcbiAgfVxufVxuXG5mdW5jdGlvbiBwYXJzZVByb3BzKHByb3BzOiBhbnkpOiBhd3MuRUtTLkNyZWF0ZUNsdXN0ZXJSZXF1ZXN0IHtcbiAgcmV0dXJuIHByb3BzPy5Db25maWcgPz8geyB9O1xufVxuXG5pbnRlcmZhY2UgVXBkYXRlTWFwIHtcbiAgcmVwbGFjZU5hbWU6IGJvb2xlYW47ICAgICAvLyBuYW1lXG4gIHJlcGxhY2VWcGM6IGJvb2xlYW47ICAgICAgLy8gcmVzb3VyY2VzVnBjQ29uZmlnLnN1Ym5ldElkcyBhbmQgc2VjdXJpdHlHcm91cElkc1xuICByZXBsYWNlUm9sZTogYm9vbGVhbjsgICAgIC8vIHJvbGVBcm5cbiAgdXBkYXRlVmVyc2lvbjogYm9vbGVhbjsgICAvLyB2ZXJzaW9uXG4gIHVwZGF0ZUxvZ2dpbmc6IGJvb2xlYW47ICAgLy8gbG9nZ2luZ1xuICB1cGRhdGVBY2Nlc3M6IGJvb2xlYW47ICAgIC8vIHJlc291cmNlc1ZwY0NvbmZpZy5lbmRwb2ludFByaXZhdGVBY2Nlc3MgYW5kIGVuZHBvaW50UHVibGljQWNjZXNzXG59XG5cbmZ1bmN0aW9uIGFuYWx5emVVcGRhdGUob2xkUHJvcHM6IFBhcnRpYWw8YXdzLkVLUy5DcmVhdGVDbHVzdGVyUmVxdWVzdD4sIG5ld1Byb3BzOiBhd3MuRUtTLkNyZWF0ZUNsdXN0ZXJSZXF1ZXN0KTogVXBkYXRlTWFwIHtcbiAgY29uc29sZS5sb2coJ29sZCBwcm9wczogJywgSlNPTi5zdHJpbmdpZnkob2xkUHJvcHMpKTtcbiAgY29uc29sZS5sb2coJ25ldyBwcm9wczogJywgSlNPTi5zdHJpbmdpZnkobmV3UHJvcHMpKTtcblxuICBjb25zdCBuZXdWcGNQcm9wcyA9IG5ld1Byb3BzLnJlc291cmNlc1ZwY0NvbmZpZyB8fCB7IH07XG4gIGNvbnN0IG9sZFZwY1Byb3BzID0gb2xkUHJvcHMucmVzb3VyY2VzVnBjQ29uZmlnIHx8IHsgfTtcblxuICByZXR1cm4ge1xuICAgIHJlcGxhY2VOYW1lOiBuZXdQcm9wcy5uYW1lICE9PSBvbGRQcm9wcy5uYW1lLFxuICAgIHJlcGxhY2VWcGM6XG4gICAgICBKU09OLnN0cmluZ2lmeShuZXdWcGNQcm9wcy5zdWJuZXRJZHMpICE9PSBKU09OLnN0cmluZ2lmeShvbGRWcGNQcm9wcy5zdWJuZXRJZHMpIHx8XG4gICAgICBKU09OLnN0cmluZ2lmeShuZXdWcGNQcm9wcy5zZWN1cml0eUdyb3VwSWRzKSAhPT0gSlNPTi5zdHJpbmdpZnkob2xkVnBjUHJvcHMuc2VjdXJpdHlHcm91cElkcyksXG4gICAgdXBkYXRlQWNjZXNzOlxuICAgICAgbmV3VnBjUHJvcHMuZW5kcG9pbnRQcml2YXRlQWNjZXNzICE9PSBvbGRWcGNQcm9wcy5lbmRwb2ludFByaXZhdGVBY2Nlc3MgfHxcbiAgICAgIG5ld1ZwY1Byb3BzLmVuZHBvaW50UHVibGljQWNjZXNzICE9PSBvbGRWcGNQcm9wcy5lbmRwb2ludFB1YmxpY0FjY2VzcyxcbiAgICByZXBsYWNlUm9sZTogbmV3UHJvcHMucm9sZUFybiAhPT0gb2xkUHJvcHMucm9sZUFybixcbiAgICB1cGRhdGVWZXJzaW9uOiBuZXdQcm9wcy52ZXJzaW9uICE9PSBvbGRQcm9wcy52ZXJzaW9uLFxuICAgIHVwZGF0ZUxvZ2dpbmc6IEpTT04uc3RyaW5naWZ5KG5ld1Byb3BzLmxvZ2dpbmcpICE9PSBKU09OLnN0cmluZ2lmeShvbGRQcm9wcy5sb2dnaW5nKSxcbiAgfTtcbn1cbiJdfQ==