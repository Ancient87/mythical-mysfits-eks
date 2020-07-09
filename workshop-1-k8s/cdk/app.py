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
)
import boto3

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
        
        
        
        ######## S3 #######
        
        mythical_bucket = s3.Bucket(
            self,
            "mythical_bucket",
            removal_policy=core.RemovalPolicy.DESTROY,
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
        
        mythical_environment = cloud9.Ec2Environment(
            self,
            "mythical_environment",
            vpc=mythical_environment_vpc,
            ec2_environment_name="mythical_environment",
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
    #role_arn=role_arn,
)

# TGWStack(app, "tgw", env=env_tgw, security_vpc=SECURITY_VPC, spoke_vpcs=SPOKE_VPCS, vpn_eni_a=VPN_ENI_A, vpn_eni_b=VPN_ENI_B)

app.synth()
