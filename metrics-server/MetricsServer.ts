import * as k8s from '@pulumi/kubernetes'
import * as pulumi from '@pulumi/pulumi'

export interface MetricsServerArgs {
}

export class MetricsServer extends pulumi.ComponentResource  {
  constructor(
    appName: string,
    args: MetricsServerArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    
    super(appName, appName, {}, opts)

    const MetricsServer = new k8s.helm.v3.Chart(
      appName,
      {
        chart: "metrics-server",
        fetchOpts: {
          repo: 'https://kubernetes-charts.storage.googleapis.com',
        },
        namespace: "kube-system",
      },
      {
        parent: this,
        dependsOn: [
        ],
      },
    )    
  }
}