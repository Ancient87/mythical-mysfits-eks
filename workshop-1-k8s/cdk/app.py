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
        
        ######## VPC ########
        
        mythical_cluster_vpc = ec2.Vpc(
            self,
            f"mythicalclustervpc",
        )
        
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
        
        
        
        cluster_role = mythical_eks_cluster.role
        
        cluster_role.add_to_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=["ec2:DescribeAccountAttributes",
                "ec2:DescribeInternetGateways",],
                resources=["*"],
            )    
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
        
        alb_service_account = eks.ServiceAccount(
            self,
            "albserviceaccount",
            cluster=mythical_eks_cluster,
            name="alb-ingress-controller",
            namespace="kube-system",
        )
        
        alb_role = alb_service_account.role
        
        pol_statement = None
        
        with open("./alb-policy.json", "r") as policy_file:
            pol_string = policy_file.read()
            pol_json = json.loads(pol_string)
            statements = pol_json["Statement"]
            for statement in statements:
                pol_statement = iam.PolicyStatement.from_json(statement)
                alb_role.add_to_policy(pol_statement)
        
        
        mythical_table.grant_read_write_data(mythical_service_account.role)
        
        mythical_eks_nodegroup = eks.Nodegroup(
            self,
            "mythicaleksnodegroup",
            cluster=mythical_eks_cluster,
            desired_size=3,
            subnets=ec2.SubnetSelection(
                subnet_type=ec2.SubnetType.PUBLIC,
            ),
        )
        
        
        
        worker_node_role = mythical_eks_nodegroup.role
        
        worker_node_role.add_managed_policy(
            iam.ManagedPolicy.from_aws_managed_policy_name(
                "AmazonElasticFileSystemFullAccess"
            )
        )
        
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
        
class MythicalDistributionStack(core.Stack):

    def __init__(
        self,
        scope: core.Construct,
        id: str,
        **kwargs,
    ) -> None:

        super().__init__(scope, id, **kwargs)
        
        mythical_bucket = s3.Bucket(
            self,
            "mythical_bucket",
            removal_policy=core.RemovalPolicy.DESTROY,
        )
        
        output_bucket = core.CfnOutput(
            self,
            "mythical_bucket_output",
            export_name="mythicalwebsite",
            value=mythical_bucket.bucket_name,
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
                ),
                
            ],
            viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.ALLOW_ALL,
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
            

ms = MythicalStack(
    app,
    "mythicalstack",
    env=env,
    stack_name="mythicalstack",
    #role_arn=role_arn,
)

md = MythicalDistributionStack(
    app,
    "mythicaldistributionstack",
    env=env,
    stack_name="mythicaldistributionstack",
    #mythical_bucket=ms.mythical_bucket
    #role_arn=role_arn,
)

# TGWStack(app, "tgw", env=env_tgw, security_vpc=SECURITY_VPC, spoke_vpcs=SPOKE_VPCS, vpn_eni_a=VPN_ENI_A, vpn_eni_b=VPN_ENI_B)

app.synth()
