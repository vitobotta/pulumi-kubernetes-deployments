# pulumi-kubernetes-deployments

This is a collection of [Pulumi](https://www.pulumi.com/) scripts I use to automate repeatitive deployments of applications and services to Kubernetes. I am still learning both Pulumi and [Typescript](https://www.typescriptlang.org/) so perhaps something could be more polished, but this code has been througly tested and is being actively maintained. This code assumes you have a Kubernetes cluster already provisioned, and Pulumi set up on your machine.

Note: when Pulumi config/secrets are required, the name of the configuration setting or secret must be prefixed with the name given to the app when instantiating the relevant class. For example, for a deployment of cert-manager named "cert-manager", the names of config/secrets must be prefixed with "cert-manager:".

## cert-manager

Deploys [cert-manager](https://cert-manager.io/), which is the most popular solution to issue and manage TLS certificates with LetsEncrypt and more, on Kubernetes. The code assumes DNS01 challenges are configured, alongside HTTP01 challenges, using [Cloudflare](https://www.cloudflare.com/). You may have to adapt the code if you use another provider or want to make this option configurable.

Configuration can be passed either as arguments when initialising the relevant class, or as configuration and secrets stored in the Pulumi stack:

```bash
pulumi config set cert-manager:version v0.14.1
pulumi config set cert-manager:email <email address for the LetsEncrypt account>
pulumi config set cert-manager:cloudflareEmail <email address for the Cloudflare account>
pulumi config set --secret cert-manager:cloudflareAPIKey <your Cloudflare API key>
```

Minimal code required to deploy cert-manager using Pulumi stack configuration is as follows:

```typescript
import { CertManager } from "../vendor/cert-manager/CertManager";

const certManager = new CertManager("cert-manager", {});
```

## Nginx ingress controller

It installs the [Nginx ingress controller](https://github.com/kubernetes/ingress-nginx).

To install as a DaemonSet using the host ports and a service of type ClusterIP:

```typescript
import { NginxIngress } from "../vendor/nginx-ingress/NginxIngress";

const nginxIngress = new NginxIngress("nginx-ingress", {
  namespace: "nginx-ingress",
  ingressClass: "nginx",
});
```

NodePort:

```typescript
const nginxIngress = new NginxIngress("nginx-ingress", {
  namespace: "nginx-ingress",
  serviceType: "NodePort",
  ingressClass: "nginx",
  nodePortHTTP: 30080,
  nodePortHTTPS: 30443
});
```

LoadBalancer:

```typescript
const nginxIngress = new NginxIngress("nginx-ingress", {
  namespace: "nginx-ingress",
  serviceType: "LoadBalancer",
  ingressClass: "nginx",
});
```

## Hetzner Cloud CSI driver

This is to integrate [Hetzner Cloud](https://www.hetzner.com/cloud) block storage in Kubernetes.

Config required:

```bash
pulumi config set hetzner-cloud-csi:version 1.2.3
pulumi config set --secret hetzner-cloud-csi:token <your HC project token>
```

To install:

```typescript
import { HetznerCloudCSI } from "../vendor/hetzner-cloud-csi/HetznerCloudCSI";

const hetznerCloudCSI = new HetznerCloudCSI("hetzner-cloud-csi", {});
```

## Postgres clusters with the Zalando operator

[Zalando Postgres Operator](https://github.com/zalando/postgres-operator) allows creating Postgres clusters very easily and quickly with replication, failover, WAL archivation to S3 and logical backups also to S3. I wrote [a blog post](https://vitobotta.com/2020/02/05/postgres-kubernetes-zalando-operator/) about it.

### Operator

Configuration:

```bash
pulumi config set zalando-postgres-operator:s3Region ...
pulumi config set zalando-postgres-operator:s3Endpoint https://...
pulumi config set zalando-postgres-operator:s3Bucket ...
pulumi config set --secret zalando-postgres-operator:s3AccessKeyId ...
pulumi config set --secret zalando-postgres-operator:s3SecretAccessKey ...
```

Installation

```typescript
import { ZalandoPostgresOperator } from "../vendor/zalando-postgres-operator/ZalandoPostgresOperator";

const zalandoPostgresOperator = new ZalandoPostgresOperator("zalando-postgres-operator", {
  namespace: "postgres-operator",
}, { dependsOn: [hetznerCloudCSI] });
```

### Clusters

Configuration:

```bash
pulumi config set postgres-cluster:s3Region ...
pulumi config set postgres-cluster:s3Endpoint https://...
pulumi config set postgres-cluster:s3Bucket ...
pulumi config set --secret postgres-cluster:s3AccessKeyId ...
pulumi config set --secret postgres-cluster:s3SecretAccessKey ...
```

#### Creating a brand new cluster

```typescript
import { ZalandoPostgresCluster } from "../vendor/zalando-postgres-operator/ZalandoPostgresCluster";

const postgresCluster = new ZalandoPostgresCluster("postgres-cluster", {
  namespace: "postgres-cluster",
  teamId: "postgres",
  storageClass: "hcloud-volumes",
  storageSize: "10Gi",
  numberOfInstances: 3,
  enableLogicalBackups: true,
  enableWalBackups: true,
}, { dependsOn: [hetznerCloudCSI, zalandoPostgresOperator] });
```

#### Restoring a cluster from WAL archive on S3

```typescript
import { ZalandoPostgresCluster } from "../vendor/zalando-postgres-operator/ZalandoPostgresCluster";

const postgresCluster = new ZalandoPostgresCluster("postgres-cluster", {
  namespace: "postgres-cluster",
  teamId: "postgres",
  storageClass: "hcloud-volumes",
  storageSize: "10Gi",
  numberOfInstances: 3,
  enableLogicalBackups: true,
  enableWalBackups: true,
  clone: true,
  cloneClusterName: "original-postgres-cluster",
  cloneClusterID: "295bf786-adaa-4864-bd35-2982ef2532bc",
  cloneTargetTime: "2050-02-04T12:49:03+00:00"
}, { dependsOn: [hetznerCloudCSI, zalandoPostgresOperator] });
```

**cloneClusterName** is the name used by the original cluster that you want to clone or restore. **cloneClusterID** is the ID of the original cluster - if you don't have access to the *postgresql* resource for the cluster anymore, you will find it in the directory on S3 where the backups are stored. **cloneTargetTime** is optional and allows you to do point-in-time recovery by restoring the data at a specific time. If omitted, the most recent backup will be restored.

## PgAdmin

[PgAdmin](https://www.pgadmin.org/) is a handy UI for Postgres that can run directly in Kubernetes.

Configuration:

```bash
pulumi config set pgadmin:email <login email>
pulumi config set --secret pgadmin:password <login password>
```

Installation:

```typescript
import { PgAdmin } from "../vendor/pgadmin/PgAdmin";

const pgAdmin = new PgAdmin("pgadmin", {
  namespace: "pgadmin",
  persistenceEnabled: true
}, { dependsOn: [hetznerCloudCSI] });
```

Note that in my case it depends on Hetzner Cloud CSI since I enable persistence.

## Velero

[Velero](https://velero.io/) is the most popular backup solution for Kubernetes. The code assumes S3 compatible storage is used for the backups.

Configuration:

```bash
pulumi config set velero:s3Bucket ...
pulumi config set velero:s3Region ...
pulumi config set velero:s3Url https://...
pulumi config set --secret velero:awsAccessKeyId ...
pulumi config set --secret velero:awsSecretAccessKey ...
```

Installation:

```typescript
import { Velero } from "../vendor/velero/Velero";

const velero = new Velero("velero", {});
```

## Harbor

[Harbor](https://goharbor.io/) is a very popular and feature rich container registry.

Configuration:

```bash
pulumi config set --secret harbor:adminPassword ...
pulumi config set --secret harbor:secretKey ...
```

Installation:

```typescript
import { Harbor } from "../vendor/harbor/Harbor";

const harbor = new Harbor("harbor", {}, { dependsOn: [hetznerCloudCSI] });
```

## Redis

Deploys Redis either in standalone mode or in clustered mode.

```typescript
import { Redis } from "../vendor/redis/Redis";

# standalone
const redisStandalone = new Redis("redis", {
  namespace: "redis",
  persistenceStorageClass: "hcloud-volumes"
}, { dependsOn: hetznerCloudCSI });

# clustered
const redis = new Redis("redis", {
  namespace: "redis",
  persistenceStorageClass: "hcloud-volumes",
  clusterEnabled: true,
  slaveCount: 2,
  sentinelEnabled: true
}, { dependsOn: hetznerCloudCSI });
```


## memcached

This installs the popular distributed cache.

```typescript
import { Memcached } from "../vendor/memcached/Memcached";

const memcached = new Memcached("memcached", {
  replicaCount: 3,
  memory: 2048
});
```

## AnyCable

[AnyCable](https://anycable.io/) is an alternative implementation of part of [ActionCable](https://guides.rubyonrails.org/action_cable_overview.html) - the native websockets solution for [Ruby on Rails](https://rubyonrails.org/) apps - that I am currently using. To install:

```typescript
import { AnyCable } from "../vendor/anycable/AnyCable";

const anyCable = new AnyCable("anycable-go", {
  hostname: "<web socket domain>",
  redisChannel: "__anycable__",
  rpcHost: "<URL of the Rails RPC service>",
  namespace: "anycable-go",
  logLevel: "debug",
  imageTag: "1.0.0.preview1",
  ingressClass: "<optional ingress class, default to 'nginx'>",
})
```

## Hetzner Cloud Floating IP controller

Installs [a controller](https://github.com/cbeneke/hcloud-fip-controller) to automaically assign floating IPs in Hetzner Cloud to a healthy node. Note that each node must have a network interface configured with the floating IPs for this to work.

Configuration:

```bash
pulumi config set --secret hetzner-cloud-fip-controller:apiToken <Hetzner Cloud token>
```

Installation:

```typescript
const hetznerCloudFIPController = new HetznerCloudFIPController("hetzner-cloud-fip-controller", {
  addresses: [
    "<floating IP 1>",
    "<floating IP 2>",
    "<floating IP N>",
  ]
});
```

## MetalLB

Installs [MetalLB](https://metallb.universe.tf/), which allows creating services of type LoadBalancer on prem or when the provider doesn't offer load balancers that can be provisioned with Kubernetes. It expects a group of IPs or IP ranges. In Hetzner Cloud I am using this with floating IPs.

Configuration:

```bash
pulumi config set --secret metallb:secretKey "$(openssl rand -base64 128)"
```

Installation:

```typescript
const metalLB = new MetalLB("metallb", {
  addresses: [
    "<IP or IP range 1>",
    "<IP or IP range 2>",
    "<IP or IP range N>",
  ]
});
```
