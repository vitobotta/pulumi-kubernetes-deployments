import * as pulumi from '@pulumi/pulumi'

const config: pulumi.Config = new pulumi.Config('nginx-ingress')

export const version: string = config.get('version') || "3.7.1"
export const namespace: string = config.get('namespace') || "nginx-ingress"
export const serviceType: string = config.get('serviceType') || "ClusterIP"
export const ingressClass: string = config.get('ingressClass') || "nginx"
export const nodePortHTTP: number = Number(config.get('nodePortHTTP')) || 30080
export const nodePortHTTPS: number = Number(config.get('nodePortHTTPS')) || 30443
export const replicaCount: number = Number(config.get('replicaCount')) || 1
export const useProxyProtocol: string = config.get('useProxyProtocol') || "false"
export const useForwardedHeaders: string = config.get('useForwardedHeaders') || "true"
export const clientMaxBodySize: string = config.get('clientMaxBodySize') || "0"
