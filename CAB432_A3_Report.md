---
title: "CAB432 Project Report"
author:
- "Sheng Xu - n11670339"
---

# Application overview

This is an **Online Video Transcoding System** that allows users to upload their videos, preview the videos, and transcode them into different formats and qualities. The system contains four services which are secure user authentication service, file storage and management service, video transcoding service, and web application service. These services are all deployed on AWS ECS as microservices to ensure scalability and flexibility.

# Application architecture

* S3: used to store user uploaded and transcoded video files efficiently
* DynamoDB: used to store metadata related to uploaded and transcoded files
* Secrets Manager: used to manage sensitive information securely including credentials
* Parameter Store: used to store application parameters including database names and api paths
* CloudFormation: used to deploy and provision all AWS services involved in the application (Infrastructure as Code)
* Elastic Container Registry (ECR): used to store container images of microservices
* Load Balancer: used to route requests to the appropriate backend service using path-based routing and manage HTTPS termination
* Certificate Manager: used to manage and renew HTTPS certificate
* Route 53: used to manage DNS record for the application
* CloudFront: used to cache static files and pages of the application
* Cognito: used to manage user information and provide authenticaiton and federated identities
* Elastic Container Service (ECS): used to orchestra microservices with containers and enable auto scaling

## Project Core - Microservices
- **First service functionality:** Auth Service (handles user authentication)
- **First service compute:** 
  - ECS
  - Name: n11670339-a3-auth-service
  - ARN: arn:aws:ecs:ap-southeast-2:901444280953:service/n11670339-assessment3/n11670339-a3-auth-service
  - Task ID: bc3b9058bc294b309636e710d376909f
- **First service source files:**
  - /auth-service
- **Second service functionality:** File Service (manages file uploads and metadata)
- **Second service compute:**
  - ECS
  - Name: n11670339-a3-file-service
  - ARN: arn:aws:ecs:ap-southeast-2:901444280953:service/n11670339-assessment3/n11670339-a3-file-service
  - Task ID: 6ed3765311274924b2b38634b8054596
- **Second service source files:**
  - /file-service
- **Video timestamp:**


## Project Additional - Additional microservices

- **Third service functionality:** Transcoding Service (handles video processing)
- **Third service compute:**
  - ECS
  - Name: n11670339-a3-transcode-service
  - ARN: arn:aws:ecs:ap-southeast-2:901444280953:service/n11670339-assessment3/n11670339-a3-transcode-service
  - Task ID: 44c342f714ed4ae1af1a05e29a9f60e6
- **Third service source files:**
  - /transcoding-service

- **Fourth service functionality:** Web Service (serves static files for the UI)
- **Fourth service compute:**
  - ECS
  - Name: n11670339-a3-web-service
  - ARN: arn:aws:ecs:ap-southeast-2:901444280953:service/n11670339-assessment3/n11670339-a3-web-service
  - Task ID: 91f91815eb714a30a30ab541d65363b2
- **Fourth service source files:**
  - /web-service

- **Video timestamp:**


## Project Additional - Serverless functions

- **Service(s) deployed on Lambda:**
- **Video timestamp:**
- **Relevant files:**

## Project Additional - Container orchestration with ECS 

- **ECS cluster name:** 
n11670339-assessment3
- **Task definition names:**   
  - n11670339-a3-auth
  - n11670339-a3-file
  - n11670339-a3-transcode
  - n11670339-a3-web
- **Video timestamp:**
- **Relevant files:**
    - /auth-service
    - /file-service
    - /transcoding-service
    - /web-service


## Project Core - Load distribution

- **Load distribution mechanism:** Application Load Balancer (ALB)
- **Mechanism instance name:** n11670339
- **Video timestamp:**
- **Relevant files:** N/A


## Project Additional - Communication mechanisms

- **Communication mechanism(s):** Routing via Application Load Balancer
- **Mechanism instance name:** n11670339
- **Video timestamp:**
- **Relevant files:**
  - /auth-service/routes/auth.js
  - /file-service/routes/file.js
  - /transcoding-service/routes/transcode.js


## Project Core - Autoscaling

- **ECS Service name:** n11670339-a3-transcode-service
- **Video timestamp:**
- **Relevant files:**
    - /transcoding-service


## Project Additional - Custom scaling metric

- **Description of metric:** [eg. age of oldest item in task queue]
- **Implementation:** [eg. custom cloudwatch metric with lambda]
- **Rationale:** [discuss both small and large scales]
- **Video timestamp:**
- **Relevant files:**


## Project Core - HTTPS

- **Domain name:** n11670339alb.cab432.com
- **Certificate ID:** 15bee52a-bdf1-42e9-985c-1f0206cb267b
- **ALB/API Gateway name:** n11670339
- **Video timestamp:**
- **Relevant files:** N/A


## Project Additional - Container orchestration features

- **First additional ECS feature:** [eg. service discovery]
- **Second additional ECS feature:**
- **Video timestamp:**
- **Relevant files:**


## Project Additional - Infrastructure as Code

- **Technology used:** CloudFormation
- **Services deployed:** ECS, ALB
- **Video timestamp:**
- **Relevant files:**
    - /cloudformation.yaml
    - /cloudformation-ecs-cluster.yaml
    - /cloudformation-ecs-auth-service.yaml
    - /cloudformation-ecs-file-service.yaml
    - /cloudformation-ecs-web-service.yaml
    - /cloudformation-ecs-transcode-service.yaml



## Project Additional - Edge Caching

- **Cloudfront Distribution ID:**
- **Content cached:**
- **Rationale for caching:**
- **Video timestamp:**
- **Relevant files:**


## Project Additional - Other (with prior permission only)

- **Description:**
- **Video timestamp:**
- **Relevant files:**


# Cost estimate

- AWS Pricing Calculator public link: https://calculator.aws/#/estimate?id=6b6557abcfb2a833e1a4095be45dbe7ca6401dc8
- DynamoDB: 0.28 USD
- S3: 6.25 USD
- ECR: 0.5 USD
- Secrets Manager: 0.9 USD
- Cognito: 2.5 USD
- Application Load Balancer: 20.4 USD
- Route 53: 0.5 USD
- CloudFront: 0.2 USD
- CloudFormation: Free
- ECS Fargate for Transcoding: 81.03 USD
- ECS Fargate for Auth, File, Web: 32.42 USD

# Scaling up


# Security


# Sustainability

