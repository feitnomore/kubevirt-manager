export class Constants {
    /* CRDs */
    public readonly ContainerizedDataImporter: string = "cdis.cdi.kubevirt.io";
    public readonly NetworkAttachmentDefinition: string = "network-attachment-definitions.k8s.cni.cncf.io";
    public readonly KubevirtManagerImages: string = "images.kubevirt-manager.io";
    public readonly Clusters: string = "clusters.cluster.x-k8s.io";
    public readonly KubeadmConfigs: string = "kubeadmconfigs.bootstrap.cluster.x-k8s.io";
    public readonly KubeadmControlPlanes: string = "kubeadmcontrolplanes.controlplane.cluster.x-k8s.io";
    public readonly MachineDeployments: string = "machinedeployments.cluster.x-k8s.io"
    public readonly KubevirtClusters: string = "kubevirtclusters.infrastructure.cluster.x-k8s.io";
    public readonly KubevirtMachineTemplates: string = "kubevirtmachinetemplates.infrastructure.cluster.x-k8s.io";

    /* General Labels and Annotations keys */
    public readonly KubernetesHostname: string = "kubernetes.io/hostname";
    public readonly KubevirtDomain: string = "kubevirt.io/domain";
    public readonly KubevirtVmPool: string = "kubevirt.io/vmpool";
    public readonly KubevirtManagerManaged: string = "kubevirt-manager.io/managed";
    public readonly KubevirtManagerCloudInit: string = "cloud-init.kubevirt-manager.io/username";
    public readonly KubevirtManagerCloudInitSsh: string = "cloud-init.kubevirt-manager.io/ssh";
    public readonly KubevirtManagerSsh: string = "kubevirt-manager.io/ssh";
    public readonly KubernetesCniNetworks: string = "k8s.v1.cni.cncf.io/network";
    public readonly KubernetesSecretSshAuth: string = "kubernetes.io/ssh-auth";

    /* Cluster API related Labels and Annotations Keys */
    public readonly KubernetesClusterName: string = "cluster.x-k8s.io/cluster-name";
    public readonly KubernetesClusterTenantServiceName: string = "cluster.x-k8s.io/tenant-service-name";
    public readonly KubernetesClusterTenantServiceNamespace: string = "cluster.x-k8s.io/tenant-service-namespace";
    public readonly KubernetesCapkTemplateKind: string = "capk.cluster.x-k8s.io/template-kind";
    public readonly KubevirtManagerCluster: string = "kubevirt-manager.io/cluster-name";
    public readonly KubevirtManagerClusterAutoscaler: string = "capk.kubevirt-manager.io/autoscaler";
    public readonly KubevirtManagerClusterAutoscalerMin: string = "cluster.x-k8s.io/cluster-api-autoscaler-node-group-min-size";
    public readonly KubevirtManagerClusterAutoscalerMax: string = "cluster.x-k8s.io/cluster-api-autoscaler-node-group-max-size";
    public readonly KubevirtManagerClusterCni: string = "capk.kubevirt-manager.io/cni";
    public readonly KubevirtManagerClusterCniVersion: string = "capk.kubevirt-manager.io/cni-version";
    public readonly KubevirtManagerClusterCniPort: string = "capk.kubevirt-manager.io/cni-vxlanport";
    public readonly KubevirtManagerClusterFlavor: string = "capk.kubevirt-manager.io/flavor";
    public readonly KubevirtManagerClusterFlavorVersion: string = "capk.kubevirt-manager.io/flavor-version";
    public readonly KubevirtManagerClusterKubernetesVersion: string = "capk.kubevirt-manager.io/kube-version";

    public readonly cloudInitNetworks: string[] = [
        'eth0',
        'eth1',
        'eth2',
        'eth3',
        'eno0',
        'eno1',
        'eno2',
        'eno3',
        'ens0',
        'ens1',
        'ens2',
        'ens3',
        'enp0s0',
        'enp0s1',
        'enp0s2',
        'enp0s3',
        'enp1s0',
        'enp1s1',
        'enp1s2',
        'enp1s3',
        'enp2s0',
        'enp2s1',
        'enp2s2',
        'enp2s3',
    ];
}
