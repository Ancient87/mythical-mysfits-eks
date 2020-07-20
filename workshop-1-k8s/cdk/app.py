#!/usr/bin/env python3

from aws_cdk import (
    core,
    aws_ecr as ecr,
    aws_ssm as ssm,
    aws_iam as iam,
    aws_ec2 as ec2,
    aws_eks as eks,
    aws_cloud9 as cloud9,
    aws_s3 as s3,
    aws_dynamodb as ddb,
    aws_s3_deployment as s3d,
    aws_cloudfront as cloudfront,
)
import boto3
import json
import logging
import os

logger = logging.getLogger("MythicalMysfitsEKS")
ch = logging.StreamHandler()
# create formatter and add it to the handlers
formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
ch.setFormatter(formatter)
# add the handlers to the logger
logger.addHandler(ch)
logger.setLevel(logging.DEBUG)

REGION = "ap-southeast-1"

app = core.App()

#prefix = app.node.try_get_context("prefix")

#vpc = app.node.try_get_context("vpc")

#role_arn = app.node.try_get_context("role_arn")

env = core.Environment(region=REGION)

class MythicalStack(core.Stack):

    def __init__(
        self,
        scope: core.Construct,
        id: str,
        #role_arn: str,
        **kwargs,
    ) -> None:

        super().__init__(scope, id, **kwargs)
        
        ######## IAM ########
        
        ######## Dynamodb #######
        
        
        mythical_table = ddb.Table(
            self,
            "mythical_table",
            partition_key=ddb.Attribute(
                name="MysfitId",
                type=ddb.AttributeType.STRING,
            )
        )
        
        mythical_table.add_global_secondary_index(
            index_name="LawChaosIndex",
            partition_key=ddb.Attribute(
                name="LawChaos",
                type=ddb.AttributeType.STRING,
            ),
            sort_key=ddb.Attribute(
                name="MysfitId",
                type=ddb.AttributeType.STRING,
            ),
            
        )
        
        mythical_table.add_global_secondary_index(
            index_name="GoodEvilIndex",
            partition_key=ddb.Attribute(
                name="GoodEvil",
                type=ddb.AttributeType.STRING,
            ),
            sort_key=ddb.Attribute(
                name="MysfitId",
                type=ddb.AttributeType.STRING,
            ),
            
        )
        
        output_ddb = core.CfnOutput(
            self,
            "mythicaltableoutput",
            export_name="MythicalTable",
            value=mythical_table.table_name,
        )
        
        ######## S3 #######
        
        
        
        
        mythical_bucket = s3.Bucket(
            self,
            "mythical_bucket",
            removal_policy=core.RemovalPolicy.DESTROY,
        )
        
        

        distribution = cloudfront.CloudFrontWebDistribution(
            self,
            "dist",
            origin_configs=[
                cloudfront.SourceConfiguration(
                    behaviors=[cloudfront.Behavior(is_default_behavior=True)],
                    s3_origin_source=cloudfront.S3OriginConfig(
                      s3_bucket_source=mythical_bucket,
                      origin_access_identity=cloudfront.OriginAccessIdentity(
                        self,
                        "spaoai",
                        comment="SPA CF OAI",
                      ),
                    ),
                )
            ],
            error_configurations=[
              {
                "errorCachingMinTtl": 0.0,
                "errorCode": 404,
                "responseCode": 200,
                "responsePagePath": "/index.html"
              },
              {
                "errorCachingMinTtl": 0.0,
                "errorCode": 403,
                "responseCode": 200,
                "responsePagePath": "/index.html"
              },
            ],
        )
        
        #spa_source = s3d.Source.asset(
        #  path = "../web",
        #  #path="../frontend/",
        #  #bundling=core.BundlingOptions(
        #  #  image=core.BundlingDockerImage.from_registry("bayesimpact/react-base"),
        #  #  command=["make", "build-prod-cloud"],
        #  #  user="root",
        #  #),
        #)
      #
        #self.spa_deployment = s3d.BucketDeployment(
        #  self,
        #  "spadeploy",
        #  destination_bucket=mythical_bucket,
        #  sources=[spa_source],
        #  distribution=distribution,
        #  #server_side_encryption=s3d.ServerSideEncryption.AWS_KMS,
        #  #server_side_encryption_aws_kms_key_id=self.bucket_key.key_id,
        #)
        
        output_cf = core.CfnOutput(
            self,
            "mythical_website",
            export_name="S3WebsiteURL",
            value=distribution.domain_name,
        )
        
        output_cf = core.CfnOutput(
            self,
            "mythical_distribution",
            export_name="mythicaldistributionoutput",
            value=distribution.distribution_id,
        )
        
        output_bucket = core.CfnOutput(
            self,
            "mythical_bucket_output",
            export_name="mythicalwebsite",
            value=mythical_bucket.bucket_name,
        )
        
        ######## VPC ########
        
        mythical_cluster_vpc = ec2.Vpc(
            self,
            f"mythicalclustervpc",
        )
        
        mythical_environment_vpc = ec2.Vpc(
            self,
            f"mythicalenvironmentvpc",
        )
        
        ######## Cloud9 ########
        
        #mythical_environment = cloud9.Ec2Environment(
        #    self,
        #    "mythical_environment",
        #    vpc=mythical_environment_vpc,
        #    ec2_environment_name="mythical_environment",
        #)
        
        ######## EKS Cluster ########
        
        
        sts = boto3.client('sts')
        current_user = sts.get_caller_identity()["Arn"]
        
        
        cluster_master_role = iam.Role(
                self,
                "adminrole",
                assumed_by= iam.AccountRootPrincipal(),
        )

        
        mythical_eks_cluster = eks.Cluster(
            self,
            "mythicalekscluster",
            cluster_name="mythical_eks_cluster",
            vpc=mythical_cluster_vpc,
            masters_role=cluster_master_role,
            #vpc_subnets=[ec2.SubnetSelection(
            #    subnet_type=ec2.SubnetType.PUBLIC,    
            #)],
            default_capacity=0,
            version=eks.KubernetesVersion.V1_16,
        )
        
        mythical_namespace_definition = {
            "apiVersion": "v1",
            "kind": "Namespace",
            "metadata": {
                "name": "mysfits"
            }
        }
        
        mythical_namespace = eks.KubernetesResource(
            self,
            "mmns",
            cluster=mythical_eks_cluster,
            manifest = [
                    mythical_namespace_definition,
            ],
        )
        
        mythical_service_account = eks.ServiceAccount(
            self,
            "serviceaccount",
            cluster=mythical_eks_cluster,
            name="mythical-service-account",
            namespace="mysfits",
        )
        
        #mythical_service_account.node.default_child.addDependsOn(
        #    mythical_namespace.node.default_child    
        #)
        
        
        mythical_table.grant_read_write_data(mythical_service_account.role)
        
        mythical_eks_nodegroup = eks.Nodegroup(
            self,
            "mythicaleksnode",
            cluster=mythical_eks_cluster,
            desired_size=2,
            subnets=ec2.SubnetSelection(
                subnet_type=ec2.SubnetType.PUBLIC,
            ),
        )
        
        worker_node_role = mythical_eks_nodegroup.role
        
        #worker_node_role.add_managed_policy(
        #    iam.ManagedPolicy.from_aws_managed_policy_name(
        #        "policy/AmazonEKSWorkerNodePolicy",
        #    )
        #)
        
        #mythical_eks_cluster = eks.FargateCluster(
        #    self,
        #    "mythicalekscluster",
        #    cluster_name="mythical_eks_cluster",
        #    vpc=mythical_cluster_vpc,
        #    #vpc_subnets=[ec2.SubnetSelection(
        #    #    subnet_type=ec2.SubnetType.PUBLIC,    
        #    #)],
        #    version=eks.KubernetesVersion.V1_16,
        #)
        
        mythical_eks_cluster_role = mythical_eks_cluster.role
    
        mythical_eks_cluster_role.add_managed_policy(
            iam.ManagedPolicy.from_aws_managed_policy_name(
                "AmazonEKSServicePolicy"
            )
        )
    
        output_cluster = core.CfnOutput(
            self,
            "mythical_eks_cluster",
            export_name="mythical-eks-cluster",
            value=mythical_eks_cluster.cluster_name
        )
    
        
        ######## ECR REPOS ########
        
        ecr_monolith = ecr.Repository(
            self,
            "monolith",
            removal_policy=core.RemovalPolicy.DESTROY,
        )
        
        ecr_monolith.grant_pull(worker_node_role)
        
        output_monolith = core.CfnOutput(
            self,
            "monolith_repository",
            export_name="mythical-monolith-repository",
            value=ecr_monolith.repository_uri
        )
        
        ecr_like = ecr.Repository(
            self,
            "like",
            removal_policy=core.RemovalPolicy.DESTROY,
        )
        
        ecr_monolith.grant_pull(worker_node_role)
        ecr_like.grant_pull(worker_node_role)
        
        output_like = core.CfnOutput(
            self,
            "like_repository",
            export_name="mythical-like-repository",
            value=ecr_like.repository_uri
        )

MythicalStack(
    app,
    "mythicalstack",
    env=env,
    stack_name="mythicalstack",
    #role_arn=role_arn,
)

# TGWStack(app, "tgw", env=env_tgw, security_vpc=SECURITY_VPC, spoke_vpcs=SPOKE_VPCS, vpn_eni_a=VPN_ENI_A, vpn_eni_b=VPN_ENI_B)

app.synth()
