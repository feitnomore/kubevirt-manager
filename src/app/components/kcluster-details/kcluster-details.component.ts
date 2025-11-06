
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { KClusterKubeadmControlPlane } from 'src/app/models/kcluster-kubeadm-control-plane.model';
import { KClusterKubevirtMachineTemplate } from 'src/app/models/kcluster-kubevirt-machine-template.model';
import { KClusterMachineDeployment } from 'src/app/models/kcluster-machine-deployment.model';
import { KCluster } from 'src/app/models/kcluster.model';
import { KubeVirtVM } from 'src/app/models/kube-virt-vm.model';
import { KubeVirtVMI } from 'src/app/models/kube-virt-vmi.model';
import { KubeVirtService } from 'src/app/services/kube-virt.service';
import { KubevirtMgrCapk } from 'src/app/services/kubevirt-mgr-capk.service';
import { K8sApisService } from 'src/app/services/k8s-apis.service';
import { XK8sService } from 'src/app/services/x-k8s.service';
import { LoadBalancer } from 'src/app/models/load-balancer.model';
import { LoadBalancerPort } from 'src/app/models/load-balancer-port.model';
import { K8sService } from 'src/app/services/k8s.service';
import { KubeadmConfigTemplate } from 'src/app/interfaces/kubeadm-config-template';
import { MachineDeployment } from 'src/app/interfaces/machine-deployment';
import { DataVolume } from 'src/app/interfaces/data-volume';
import { KubevirtMachineTemplate } from 'src/app/interfaces/kubevirt-machine-template';
import { Constants } from 'src/app/constants';
 
@Component({
  selector: 'app-kcluster-details',
  templateUrl: './kcluster-details.component.html',
  styleUrls: ['./kcluster-details.component.css']
})
export class KClusterDetailsComponent implements OnInit {

    myConstants!: Constants;
    clusterName: string = "";
    clusterNamespace: string = "";
    clusterImageList: any;
    activeCluster: KCluster = new KCluster;

    vmNetwork1 = {
        name: "",
        type: "",
        network: "",
        ip: ""
    };

    constructor(
        private router: Router,
        private route: ActivatedRoute,
        private kubevirtMgrCapk: KubevirtMgrCapk,
        private k8sApisService: K8sApisService,
        private k8sService: K8sService,
        private xK8sService: XK8sService,
        private kubeVirtService: KubeVirtService
    ) { }

    async ngOnInit(): Promise<void> {
        this.clusterName = this.route.snapshot.params['name'];
        this.clusterNamespace = this.route.snapshot.params['namespace'];
        let navTitle = document.getElementById("nav-title");
        if(navTitle != null) {
            navTitle.replaceChildren("Kubernetes Cluster Details");
        }
        this.myConstants = new Constants();
        await this.loadCluster();
        await this.loadControlPlaneVMs();
        await this.loadClusterFeatures();
        await this.loadLoadBalancers();
        await this.loadClusterImages();
    }

    /*
     * Load Image List for Cluster
     */
    async loadClusterImages(): Promise<void> {
        try {
            const data = await lastValueFrom(this.kubevirtMgrCapk.loadImages());
            this.clusterImageList = data;
        } catch (e: any) {
            console.log(e);
        }
    }

    /*
     * Load Services for Cluster
     */
    async loadLoadBalancers(): Promise<void> {
        try {
            const data = await lastValueFrom(this.xK8sService.getKCCServices(this.clusterNamespace, this.clusterName));
            let services = data.items;
            for(let i = 0; i < services.length; i++) {
                let currentLoadBalancer = new LoadBalancer();
                currentLoadBalancer.name = services[i].metadata.name;
                currentLoadBalancer.namespace = services[i].metadata.namespace;
                currentLoadBalancer.creationTimestamp = new Date(services[i].metadata.creationTimestamp);
                currentLoadBalancer.type = services[i].spec.type;
                currentLoadBalancer.clusterIP = services[i].spec.clusterIP;
                if (services[i].metadata.labels[this.myConstants.KubernetesClusterTenantServiceName] != null) {
                    currentLoadBalancer.targetResource = services[i].metadata.labels[this.myConstants.KubernetesClusterTenantServiceNamespace] + ":" + services[i].metadata.labels[this.myConstants.KubernetesClusterTenantServiceName];
                } else {
                    currentLoadBalancer.targetResource = "N/A";
                }
                if(currentLoadBalancer.type.toLowerCase() == "loadbalancer" && services[i].status.loadBalancer.ingress) {
                    if(services[i].status.loadBalancer.ingress[0].ip != null) {
                        currentLoadBalancer.loadBalancer = services[i].status.loadBalancer.ingress[0].ip;
                    } else {
                        currentLoadBalancer.loadBalancer = "N/A";
                    }
                } else {
                    currentLoadBalancer.loadBalancer = "N/A";
                }
                let servicePorts = services[i].spec.ports;
                for(let j = 0; j < servicePorts.length; j++) {
                    let thisPort = new LoadBalancerPort();
                    if(servicePorts[j].name != null) {
                        thisPort.name = servicePorts[j].name;
                    }
                    thisPort.protocol = servicePorts[j].protocol;
                    thisPort.listenport = servicePorts[j].port;
                    thisPort.targetport = servicePorts[j].targetPort;
                    currentLoadBalancer.ports.push(thisPort);
                }
                this.activeCluster.loadBalancerList.push(currentLoadBalancer);
            }
        } catch (e: any) {
            console.log(e);
        }
    }

    /*
     * Load Features for Cluster
     */
    async loadClusterFeatures(): Promise<void> {
        try {
            const data = await lastValueFrom(this.k8sService.getSecret(this.clusterNamespace, this.clusterName + "-config"));
            if(data.data["cert-manager.yaml"] != null) {
                this.activeCluster.features.certManager = true;
            }
            if(data.data["dashboard.yaml"] != null) {
                this.activeCluster.features.kubeDashboard = true;
            }
            if(data.data["metrics.yaml"] != null) {
                this.activeCluster.features.metricsServer = true;
            }
            if(data.data["haproxy-ingress.yaml"] != null) {
                this.activeCluster.features.haproxyIngress = true;
            }
            if(data.data["nginx-ingress.yaml"] != null) {
                this.activeCluster.features.nginxIngress = true;
            }
            if(data.data["tekton.yaml"] != null) {
                this.activeCluster.features.tekton = true;
            }
        } catch (e: any) {
            console.log(e);
        }
    }

    /*
     * Load Cluster Info
     */
    async loadCluster(): Promise<void> {
        let cluster = await lastValueFrom(this.xK8sService.getCluster(this.clusterNamespace, this.clusterName));
        let thisCluster = new KCluster();
        thisCluster.name = cluster.metadata.name;
        thisCluster.namespace = cluster.metadata.namespace;
        if(cluster.metadata.labels != null) {
            thisCluster.labels = cluster.metadata.labels;
            try {
                if(cluster.metadata.labels[this.myConstants.KubevirtManagerClusterCni] != null) {
                    thisCluster.cniPlugin = cluster.metadata.labels[this.myConstants.KubevirtManagerClusterCni];
                } else {
                    thisCluster.cniPlugin = "manual";
                }
            } catch (e: any) {
                thisCluster.cniPlugin = "manual";
                console.log(e);
            }
            try {
                if(cluster.metadata.labels[this.myConstants.KubevirtManagerClusterCniVersion] != null) {
                    thisCluster.cniPluginVersion = cluster.metadata.labels[this.myConstants.KubevirtManagerClusterCniVersion];
                } else {
                    thisCluster.cniPluginVersion = "manual";
                }
                
            } catch (e: any) {
                thisCluster.cniPluginVersion = "manual";
                console.log(e);
            }
            try {
                if(cluster.metadata.labels[this.myConstants.KubevirtManagerClusterCniPort] != null) {
                    thisCluster.cniVXLANPort = cluster.metadata.labels[this.myConstants.KubevirtManagerClusterCniPort];
                } else {
                    thisCluster.cniVXLANPort = "manual";
                }
                
            } catch (e: any) {
                thisCluster.cniVXLANPort = "manual";
                console.log(e);
            }
            try {
                if(cluster.metadata.labels[this.myConstants.KubevirtManagerClusterAutoscaler] != null) {
                    if(cluster.metadata.labels[this.myConstants.KubevirtManagerClusterAutoscaler] == "true") {
                        thisCluster.clusterAutoscaler = true;
                        this.enableNewPoolAutoscaling();
                    } else {
                        thisCluster.clusterAutoscaler = false;
                    }
                } else {
                    thisCluster.clusterAutoscaler = false;
                }
                
            } catch (e: any) {
                thisCluster.clusterAutoscaler = false;
                console.log(e);
            }
        }
        thisCluster.creationTimestamp = new Date(cluster.metadata.creationTimestamp);
        thisCluster.cpHost = cluster.spec.controlPlaneEndpoint.host;
        thisCluster.cpPort = cluster.spec.controlPlaneEndpoint.port;
        thisCluster.cpName = cluster.spec.controlPlaneRef.name;
        thisCluster.cpNamespace = cluster.spec.controlPlaneRef.namespace;
        thisCluster.infName = cluster.spec.infrastructureRef.name;
        thisCluster.infNamespace = cluster.spec.infrastructureRef.namespace;
        for(let j = 0; j < cluster.spec.clusterNetwork.pods.cidrBlocks.length; j++) {
            thisCluster.podCidrs += cluster.spec.clusterNetwork.pods.cidrBlocks[j];
        }
        for(let j = 0; j < cluster.spec.clusterNetwork.services.cidrBlocks.length; j++) {
            thisCluster.svcCidrs += cluster.spec.clusterNetwork.services.cidrBlocks[j];
        }

        /* Maybe get from other place */
        try {
            if(cluster.status.controlPlaneReady != null) {
                thisCluster.controlPlaneReady = cluster.status.controlPlaneReady;
            } else {
                thisCluster.controlPlaneReady = false;
            }
        } catch (e: any) {
            thisCluster.controlPlaneReady = false;
            console.log(e);
        }

        /* Maybe get from other place */
        try {
            if(cluster.status.infrastructureReady != null) {
                thisCluster.infrastructureReady = cluster.status.infrastructureReady;
            } else {
                thisCluster.infrastructureReady = false;
            }
        } catch (e: any) {
            thisCluster.infrastructureReady = false;
            console.log(e);
        }

        /* Loading MachineDeployments information */
        let data = await lastValueFrom(this.xK8sService.getClusterMachineDeployments(thisCluster.namespace, thisCluster.name));
        let workerpools = data.items;
        for(let j = 0; j < workerpools.length; j++) {
            thisCluster.totalWorkers += workerpools[j].spec.replicas;
            let thisWorker = workerpools[j];
            let thisWorkerPool = new KClusterMachineDeployment();
            thisWorkerPool.name = thisWorker.metadata.name;
            thisWorkerPool.namespace = thisWorker.metadata.namespace;
            if(thisWorker.metadata.labels != null) {
                thisWorkerPool.labels = thisWorker.metadata.labels;
            }
            thisWorkerPool.clusterName = thisWorker.spec.clusterName;
            thisWorkerPool.replicas = thisWorker.spec.replicas;
            thisWorkerPool.version = thisWorker.spec.template.spec.version;

            /* Loading Machine Template */
            let workertemplate = await lastValueFrom(this.xK8sService.getKubevirtMachineTemplate(thisWorker.spec.template.spec.infrastructureRef.namespace, thisWorker.spec.template.spec.infrastructureRef.name));
            let thisWorkerTemplate = new KClusterKubevirtMachineTemplate;
            thisWorkerTemplate.name = workertemplate.metadata.name;
            thisWorkerTemplate.namespace = workertemplate.metadata.namespace;
            
            /* labels */
            if(workertemplate.metadata.labels != null) {
                thisWorkerTemplate.labels = workertemplate.metadata.labels;
            }

            /* Getting VM Type */
            try {
                thisWorkerTemplate.instType = workertemplate.spec.template.spec.virtualMachineTemplate.spec.instancetype.name;
            } catch(e: any) {
                thisWorkerTemplate.instType = "custom";
                console.log(e);
            }

            if(thisWorkerTemplate.instType == "custom") {
                try {
                    /* Custom VM has cpu / mem parameters */
                    thisWorkerTemplate.cores = workertemplate.spec.template.spec.virtualMachineTemplate.spec.domain.cpu["cores"];
                    thisWorkerTemplate.sockets = workertemplate.spec.template.spec.virtualMachineTemplate.spec.domain.cpu["sockets"];
                    thisWorkerTemplate.threads = workertemplate.spec.template.spec.virtualMachineTemplate.spec.domain.cpu["threads"];
                    thisWorkerTemplate.memory = workertemplate.spec.template.spec.virtualMachineTemplate.spec.domain.resources.requests["memory"];
                } catch (e: any){
                    thisWorkerTemplate.cores = thisWorkerTemplate.cores || 0;
                    thisWorkerTemplate.sockets = thisWorkerTemplate.sockets || 0;
                    thisWorkerTemplate.threads = thisWorkerTemplate.threads || 0;
                    thisWorkerTemplate.memory = thisWorkerTemplate.memory || "N/A";
                    console.log(e);
                }
    
            } else {
                /* load vCPU / Mem from type */
                try {
                    const data = await lastValueFrom(this.kubeVirtService.getClusterInstanceType(thisWorkerTemplate.instType));
                    thisWorkerTemplate.cores = data.spec.cpu["guest"];
                    thisWorkerTemplate.memory = data.spec.memory["guest"];
                    thisWorkerTemplate.sockets = 1;
                    thisWorkerTemplate.threads = 1;
                } catch (e: any) {
                    thisWorkerTemplate.sockets = 0;
                    thisWorkerTemplate.threads = 0;
                    thisWorkerTemplate.cores = 0;
                    thisWorkerTemplate.memory = "";
                    console.log(e);
                }
            }

            thisWorkerTemplate.clusterName = workertemplate.metadata.ownerReferences[0].name;
            try {
                thisWorkerTemplate.priorityClass = workertemplate.spec.template.spec.virtualMachineTemplate.spec.template.spec.priorityClassName;
            } catch (e: any) {
                thisWorkerTemplate.priorityClass = "";
                console.log(e);
            }
            thisWorkerPool.machineTemplate = thisWorkerTemplate;
            thisCluster.machineDeployments.push(thisWorkerPool);
            thisCluster.workerPools += 1;
        }

        /* Loading Control Plane information */
        let cp = await lastValueFrom(this.xK8sService.getClusterControlPlane(thisCluster.namespace, thisCluster.cpName));
        let thisControlPlane = new KClusterKubeadmControlPlane();
        thisControlPlane.name = cp.metadata.name;
        thisControlPlane.namespace = cp.metadata.namespace;
        if(cp.metadata.labels != null) {
            thisControlPlane.labels = cp.metadata.labels;
        }
        thisControlPlane.clusterName = cp.metadata.ownerReferences[0].name;
        thisControlPlane.dnsDomain = cp.spec.kubeadmConfigSpec.clusterConfiguration.networking.dnsDomain;
        thisControlPlane.podSubnet = cp.spec.kubeadmConfigSpec.clusterConfiguration.networking.podSubnet;
        thisControlPlane.serviceSubnet = cp.spec.kubeadmConfigSpec.clusterConfiguration.networking.serviceSubnet;
        thisControlPlane.replicas = cp.spec.replicas;
        thisControlPlane.version = cp.spec.version;
        try {
            if(cp.status.initialized != null) {
                thisControlPlane.initialized = cp.status.initialized;
            } else {
                thisControlPlane.initialized = false;
            }
        } catch (e: any) {
            thisControlPlane.initialized = false;
            console.log(e);
        }
        try {
            if (cp.status.ready != null) {
                thisControlPlane.ready = cp.status.ready;
            } else {
                thisControlPlane.ready = false;
            }
        } catch (e: any) {
            thisControlPlane.ready = false;
            console.log(e);
        }

        /* Loading Machine Template */
        let cptemplate = await lastValueFrom(this.xK8sService.getKubevirtMachineTemplate(cp.spec.machineTemplate.infrastructureRef.namespace, cp.spec.machineTemplate.infrastructureRef.name));
        let thisCPTemplate = new KClusterKubevirtMachineTemplate;
        thisCPTemplate.name = cptemplate.metadata.name;
        thisCPTemplate.namespace = cptemplate.metadata.namespace;

        /* labels */
        if(cptemplate.metadata.labels != null) {
            thisCPTemplate.labels = cptemplate.metadata.labels;
        }

        /* Getting VM Type */
        try {
            thisCPTemplate.instType = cptemplate.spec.template.spec.virtualMachineTemplate.spec.instancetype.name;
        } catch(e: any) {
            thisCPTemplate.instType = "custom";
            console.log(e);
        }

        /* Load Net Info */
        this.loadNetInfo(cptemplate.spec.template.spec.virtualMachineTemplate.spec.template.spec.domain.devices.interfaces, cptemplate.spec.template.spec.virtualMachineTemplate.spec.template.spec.networks);

        if(thisCPTemplate.instType == "custom") {
            try {
                /* Custom VM has cpu / mem parameters */
                thisCPTemplate.cores = cptemplate.spec.template.spec.virtualMachineTemplate.spec.template.spec.domain.cpu["cores"];
                thisCPTemplate.sockets = cptemplate.spec.template.spec.virtualMachineTemplate.spec.template.spec.domain.cpu["sockets"];
                thisCPTemplate.threads = cptemplate.spec.template.spec.virtualMachineTemplate.spec.template.spec.domain.cpu["threads"];
                thisCPTemplate.memory = cptemplate.spec.template.spec.virtualMachineTemplate.spec.template.spec.domain.resources.requests["memory"];
            } catch (e: any){
                thisCPTemplate.cores = thisCPTemplate.cores || 0;
                thisCPTemplate.sockets = thisCPTemplate.sockets || 0;
                thisCPTemplate.threads = thisCPTemplate.threads || 0;
                thisCPTemplate.memory = thisCPTemplate.memory || "N/A";
                console.log(e);
            }

        } else {
            /* load vCPU / Mem from type */
            try {
                const data = await lastValueFrom(this.kubeVirtService.getClusterInstanceType(thisCPTemplate.instType));
                thisCPTemplate.cores = data.spec.cpu["guest"];
                thisCPTemplate.memory = data.spec.memory["guest"];
                thisCPTemplate.sockets = 1;
                thisCPTemplate.threads = 1;
            } catch (e: any) {
                thisCPTemplate.sockets = 0;
                thisCPTemplate.threads = 0;
                thisCPTemplate.cores = 0;
                thisCPTemplate.memory = "";
                console.log(e);
            }
        }


        thisCPTemplate.clusterName = cptemplate.metadata.ownerReferences[0].name;
        try {
            thisCPTemplate.priorityClass = cptemplate.spec.template.spec.virtualMachineTemplate.spec.template.spec.priorityClassName;
        } catch (e: any) {
            thisCPTemplate.priorityClass = "";
            console.log(e);
        }
        thisControlPlane.machineTemplate = thisCPTemplate;
        thisCluster.controlPlane = thisControlPlane;
        this.activeCluster = thisCluster;
    }

    /*
     * Load Control Plane VM List
     */
    async loadControlPlaneVMs(): Promise<void> {
        let currentVm = new KubeVirtVM;
        const data = await lastValueFrom(this.xK8sService.getClusterControlPlaneNodes(this.activeCluster.controlPlane.namespace, this.activeCluster.controlPlane.name));
        let vms = data.items;
        for (let i = 0; i < vms.length; i++) {
            currentVm = new KubeVirtVM();
            currentVm.name = vms[i].metadata["name"];
            currentVm.namespace = vms[i].metadata["namespace"];
            currentVm.creationTimestamp = new Date(vms[i].metadata["creationTimestamp"]);
            try {
                currentVm.status = vms[i].status["printableStatus"].toLowerCase();
                /* Working around a bug when scaling down and VM stuck in terminating */
                if(currentVm.status.toLowerCase() == "terminating") {
                    currentVm.running = false;
                } else if (currentVm.status.toLowerCase() == "running") {
                    currentVm.running = true;
                } else {
                    currentVm.running = vms[i].spec["running"];
                }
            } catch (e: any) {
                currentVm.status = "";
                currentVm.running = false;
                console.log(e);
            }
            try {
                if(vms[i].spec.template.spec.nodeSelector) {
                    currentVm.nodeSel = vms[i].spec.template.spec.nodeSelector[this.myConstants.KubernetesHostname];
                } else {
                    currentVm.nodeSel = "auto-select";
                }
            } catch (e: any) {
                currentVm.nodeSel = "auto-select";
                console.log(e);
            }

            /* Getting VM Type */
            try {
                currentVm.instType = vms[i].spec.instancetype.name;
            } catch(e: any) {
                currentVm.instType = "custom";
                console.log(e);
            }

            if(currentVm.instType == "custom") {
                try {
                    /* Custom VM has cpu / mem parameters */
                    currentVm.cores = vms[i].spec.template.spec.domain.cpu["cores"];
                    currentVm.sockets = vms[i].spec.template.spec.domain.cpu["sockets"];
                    currentVm.threads = vms[i].spec.template.spec.domain.cpu["threads"];
                    currentVm.memory = vms[i].spec.template.spec.domain.resources.requests["memory"];
                } catch (e: any) {
                    currentVm.cores = currentVm.cores || 0;
                    currentVm.sockets = currentVm.sockets || 0;
                    currentVm.threads = currentVm.threads || 0;
                    currentVm.memory = currentVm.memory || "N/A";
                    console.log(e);
                }

            } else {
                /* load vCPU / Mem from type */
                try {
                    const data = await lastValueFrom(this.kubeVirtService.getClusterInstanceType(currentVm.instType));
                    currentVm.cores = data.spec.cpu["guest"];
                    currentVm.memory = data.spec.memory["guest"];
                    currentVm.sockets = 1;
                    currentVm.threads = 1;
                } catch (e: any) {
                    currentVm.sockets = 0;
                    currentVm.threads = 0;
                    currentVm.cores = 0;
                    currentVm.memory = "";
                    console.log(e);
                }
            }

            if(vms[i].status["ready"] != null) {
                currentVm.ready = vms[i].status["ready"];
            }

            if(currentVm.running && currentVm.status && vms[i].status["printableStatus"].toLowerCase() == "running") {
                let currentVmi = new KubeVirtVMI;
                try {
                    const datavmi = await lastValueFrom(this.kubeVirtService.getVMi(currentVm.namespace, currentVm.name));
                    currentVmi = new KubeVirtVMI();
                    currentVmi.name = datavmi.metadata["name"];
                    currentVmi.namespace = datavmi.metadata["namespace"];
                    currentVmi.creationTimestamp = new Date(datavmi.metadata["creationTimestamp"]);
                    currentVmi.osId = datavmi.status.guestOSInfo["id"];
                    currentVmi.osKernRel = datavmi.status.guestOSInfo["kernelRelease"];
                    currentVmi.osKernVer = datavmi.status.guestOSInfo["kernelVersion"];
                    currentVmi.osName = datavmi.status.guestOSInfo["name"];
                    currentVmi.osPrettyName = datavmi.status.guestOSInfo["prettyName"];
                    currentVmi.osVersion = datavmi.status.guestOSInfo["version"];

                    /* Only works with guest-agent installed if not on podNetwork */
                    try {
                        currentVm.nodeSel = datavmi.status["nodeName"];
                        /* In case of dual NIC, test which one is providing IP */
                        if(datavmi.status.interfaces[0]["ipAddress"] != null) {                        
                            currentVmi.ifAddr = datavmi.status.interfaces[0]["ipAddress"];
                            currentVmi.ifName = datavmi.status.interfaces[0]["name"];
                        } else {
                            currentVmi.ifAddr = datavmi.status.interfaces[1]["ipAddress"];
                            currentVmi.ifName = datavmi.status.interfaces[1]["name"];
                        }
                    } catch(e: any) {
                        currentVmi.ifAddr = "";
                        currentVmi.ifName = "";
                        console.log(e);
                    }

                    currentVmi.nodeName = datavmi.status["nodeName"];
                    currentVm.vmi = currentVmi;
                } catch (e: any) {
                    console.log(e);
                    console.log("ERROR Retrieving VMI: " + currentVm.name + "-" + currentVm.namespace + ":" + currentVm.status);
                }
            }
            this.activeCluster.controlPlane.vmlist.push(currentVm);
        }
    }

    /*
     * Retrieve Image Url
     */
    getImageUrl(version: string, osdist: string, osversion: string): string {
        let myUrl = "";
        for(let i = 0; i < this.clusterImageList.versions.length; i++) {
            if(this.clusterImageList.versions[i].name == version) {
                for(let j = 0; j < this.clusterImageList.versions[i].flavors.length; j++) {
                    if(this.clusterImageList.versions[i].flavors[j].id == osdist) {
                        for(let k = 0; k < this.clusterImageList.versions[i].flavors[j].versions.length; k++) {
                            if(this.clusterImageList.versions[i].flavors[j].versions[k].id == osversion) {
                                myUrl = this.clusterImageList.versions[i].flavors[j].versions[k].image;
                            }
                        }
                    }
                }
            }
        }
        return myUrl.toString();
    }

    /*
     * Generate Kubeconfig
     */
    async getKubeconfig(namespace: string, name: string): Promise<void> {
        try {
            const data = await lastValueFrom(this.k8sService.getSecret(namespace, name + "-kubeconfig"));
            let base64data = data.data.value;
            const src = `data:text/yaml;base64,${base64data}`;
            const link = document.createElement("a");
            link.href = src;
            link.download = namespace + "-" + name + "-kubeconfig";
            link.click();
            link.remove();
        } catch (e: any) {
            console.log(e);
        }            
    }

    /*
     * Download SSH Key (capk user)
     */
    async getSSHKey(namespace: string, name: string): Promise<void> {
        try {
            let data = await lastValueFrom(this.k8sService.getSecret(namespace, name + "-ssh-keys"));
            let base64data = data.data.key;
            const src = `data:application/x-pem-file;base64,${base64data}`;
            const link = document.createElement("a");
            link.href = src;
            link.download = namespace + "-" + name + "-ssh.pem";
            link.click();
            link.remove();
        } catch (e: any) {
            console.log(e);
        }
    }

    /*
     * VM Basic Operations (start, stop, etc...)
     */
    async vmOperations(vmOperation: string, vmNamespace: string, vmName: string): Promise<void> {
        if(vmOperation == "start"){
            var data = await lastValueFrom(this.kubeVirtService.startVm(vmNamespace, vmName));
            this.reloadComponent();
        } else if (vmOperation == "stop") {
            var data = await lastValueFrom(this.kubeVirtService.stopVm(vmNamespace, vmName));
            this.reloadComponent();
        } else if (vmOperation == "reboot"){
            var data = await lastValueFrom(this.kubeVirtService.restartVm(vmNamespace, vmName));
            this.reloadComponent();
        } else if (vmOperation == "delete") {
            const data = await lastValueFrom(this.kubeVirtService.deleteVm(vmNamespace, vmName));
            this.reloadComponent();
        }
    }

    /*
     * Enable New Pool Autoscaling
     */
    enableNewPoolAutoscaling(): void {
        let inputAs = document.getElementById("newnodepool-autoscaling");
        let inputMin = document.getElementById("newnodepool-minreplicas")
        let inputMax = document.getElementById("newnodepool-maxreplicas");
        if(inputAs != null && inputMin != null && inputMax != null) {
            inputAs.setAttribute("value", "true");
            inputMin.removeAttribute("disabled");
            inputMax.removeAttribute("disabled");
        }
    }

    /*
     * Show Control Plane Replicas Window
     */
    showReplicasCp(cpName: string): void {
        let modalDiv = document.getElementById("modal-replicas-cp");
        let modalTitle = document.getElementById("replicas-cp-title");
        if(modalTitle != null) {
            modalTitle.replaceChildren("Scale: " + cpName);
        }
        if(modalDiv != null) {
            modalDiv.setAttribute("class", "modal fade show");
            modalDiv.setAttribute("aria-modal", "true");
            modalDiv.setAttribute("role", "dialog");
            modalDiv.setAttribute("aria-hidden", "false");
            modalDiv.setAttribute("style","display: block;");
        }
    }

    /*
     * Perform Resize of Control Plane
     */
    async applyReplicasCp(cpNamespace: string, cpName: string, replicasSize: string): Promise<void> {
        if(replicasSize != null) {
            let replicasNum: number = Number(replicasSize);
            if(replicasNum  % 2 != 0) {
                try {
                    const data = await lastValueFrom(this.xK8sService.scaleKubeadmControlPlane(cpNamespace, cpName, replicasSize));
                    this.hideComponent("modal-replicas-cp");
                    this.reloadComponent();
                } catch (e: any) {
                    alert(e.error.message);
                    console.log(e);
                }
            } else {
                alert("Control plane needs an odd number of replcias!");
            }
        }
    }

    /*
     * Show Config Control Plane Window
     */
    async showConfigCp(): Promise<void> {
        let modalDiv = document.getElementById("modal-config-cp");
        let modalTitle = document.getElementById("config-cp-title");
        let selectorCPTypeField = document.getElementById("config-controlplane-type");
        let selectorCPPCField = document.getElementById("config-controlplane-pc");
        let selectorCPSCField = document.getElementById("config-controlplane-disksc");

        let i = 0;

        /* Load ClusterInstanceType List and Set Selector */
        let data = await lastValueFrom(this.kubeVirtService.getClusterInstanceTypes());
        let typeSelectorOptions = "<option value=none></option>";
        for (i = 0; i < data.items.length; i++) {
            typeSelectorOptions += "<option value=" + data.items[i].metadata["name"] +">" + data.items[i].metadata["name"] + "</option>\n";
        }
        if (selectorCPTypeField != null) {
            typeSelectorOptions += "<option value=custom>custom</option>\n";
            selectorCPTypeField.innerHTML = typeSelectorOptions;
        }

        /* Load Storage Class List and Set Selector */
        data = await lastValueFrom(this.k8sApisService.getStorageClasses());
        let storageSelectorOptions = "";
        for (i = 0; i < data.items.length; i++) {
            storageSelectorOptions += "<option value=" + data.items[i].metadata["name"] +">" + data.items[i].metadata["name"] + "</option>\n";
        }
        if (selectorCPSCField != null) {
            selectorCPSCField.innerHTML = storageSelectorOptions;
        }

        /* Load Priority Class List and Set Selector */
        data = await lastValueFrom(this.k8sApisService.getPriorityClasses());
        let prioritySelectorOptions = "";
        for (i = 0; i < data.items.length; i++) {
            if(data.items[i].metadata["name"].toLowerCase() == "vm-standard") {
                prioritySelectorOptions += "<option value=" + data.items[i].metadata["name"] +" selected>" + data.items[i].metadata["name"] + "</option>\n";
            } else {
                prioritySelectorOptions += "<option value=" + data.items[i].metadata["name"] +">" + data.items[i].metadata["name"] + "</option>\n";
            }
        }
        if (selectorCPPCField != null) {
            selectorCPPCField.innerHTML = prioritySelectorOptions;
        }

        if(modalTitle != null) {
            modalTitle.replaceChildren("Change Control Plane Type");
        }
        if(modalDiv != null) {
            modalDiv.setAttribute("class", "modal fade show");
            modalDiv.setAttribute("aria-modal", "true");
            modalDiv.setAttribute("role", "dialog");
            modalDiv.setAttribute("aria-hidden", "false");
            modalDiv.setAttribute("style","display: block;");
        }
    }

    /*
     * Control Plane Type
     */
    async onChangeControlPlaneType(vmType: string) {
        let modalDiv = document.getElementById("config-custom-cpu-memory");
        if(vmType.toLowerCase() == "custom") {
            if(modalDiv != null) {
                modalDiv.setAttribute("class", "modal fade show");
                modalDiv.setAttribute("aria-modal", "true");
                modalDiv.setAttribute("role", "dialog");
                modalDiv.setAttribute("aria-hidden", "false");
                modalDiv.setAttribute("style","display: contents;");
            }
        } else {
            if(modalDiv != null) {
                modalDiv.setAttribute("class", "modal fade");
                modalDiv.setAttribute("aria-modal", "false");
                modalDiv.setAttribute("role", "");
                modalDiv.setAttribute("aria-hidden", "true");
                modalDiv.setAttribute("style","display: none;");
            }
        }
    }

    /*
     * Update Control Plane Template
     */
    async applyControlPlaneConfig(
        controlplanetype: string,
        controlplanecpumemsockets: string,
        controlplanecpumemcores: string,
        controlplanecpumemthreads: string,
        controlplanecpumemmemory: string,
        controlplanepc: string,
        controlplanedisksize: string,
        controlplanedisksc: string,
        controlplanediskam: string,
        controlplanediskcm: string
    ) {

        /* Loading control plane data needed for validation */
        let controlPlaneTypedCpus = 0;
        if(controlplanetype != "custom" && controlplanetype != "")
        {
            try {
                const data = await lastValueFrom(this.kubeVirtService.getClusterInstanceType(controlplanetype));
                controlPlaneTypedCpus = Number(data.spec.cpu["guest"]);
            } catch (e: any) {
                console.log(e);
            }
        }

        if(controlplanetype.toLowerCase() == "none" || controlplanetype.toLowerCase() == "") {
            alert("Please select a valid VM Type for Control Plane!");
        } else if(controlplanedisksize == "") {
            alert("Check Control Plane disk size!");
        } else if((controlplanetype == "custom") && ((Number(controlplanecpumemcores) * Number(controlplanecpumemsockets) * Number(controlplanecpumemthreads)) < 2 )) {
            alert("Control Plane machines needs at least 2 vCPU!");
        } else if(controlplanetype != "custom" && controlPlaneTypedCpus < 2) {
            alert("Control Plane machines needs at least 2 vCPU, choose a bigger VM Type!");
        } else if(controlplanedisksize == "") {
            alert("Check Control Plane disk size!");
        } else {

            let thisimageurl = "";

            /* Loading current MachineTemplate */
            let actualMachineTemplate = await lastValueFrom(this.xK8sService.getKubevirtMachineTemplate(this.activeCluster.namespace, this.activeCluster.controlPlane.name));
            try {
                thisimageurl = actualMachineTemplate.spec.template.spec.virtualMachineTemplate.spec.dataVolumeTemplates[0].spec.source.http.url;
            } catch (e: any) {
                console.log(e);
            }

            /* Custom Labels */
            let machineTemplateLabels = this.activeCluster.controlPlane.machineTemplate.labels;

            /* 
            * Kubevirt Machine Template
            */
            let kubevirtMachineTemplate: KubevirtMachineTemplate = {
                apiVersion: "infrastructure.cluster.x-k8s.io/v1alpha1",
                kind: "KubevirtMachineTemplate",
                metadata: {
                    name: this.activeCluster.name + "-control-plane",
                    namespace: this.activeCluster.namespace,
                    labels: machineTemplateLabels
                },
                spec: {
                    template: {
                        spec: {
                            virtualMachineTemplate: {
                                metadata: {
                                    namespace: this.activeCluster.namespace,
                                    labels: machineTemplateLabels
                                },
                                spec: {
                                    dataVolumeTemplates: {},
                                    runStrategy: "Once",
                                    template: {
                                        metadata: {
                                            labels: machineTemplateLabels
                                        },
                                        spec: {
                                            priorityClassName: controlplanepc,
                                            domain: {
                                                devices: {
                                                    disks: {},
                                                    interfaces: {},
                                                    networkInterfaceMultiqueue: true,
                                                },
                                            },
                                            networks: {},
                                            volumes: {},
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            };
            /* Check Control Plane VM Type */
            if(controlplanetype.toLowerCase() == "custom") {
                /* Custom VM */
                kubevirtMachineTemplate.spec.template.spec.virtualMachineTemplate.spec.template.spec.domain.cpu = {
                    cores: Number(controlplanecpumemcores),
                    threads: Number(controlplanecpumemthreads),
                    sockets: Number(controlplanecpumemsockets)                                
                };
                kubevirtMachineTemplate.spec.template.spec.virtualMachineTemplate.spec.template.spec.domain.resources = {
                    requests: {
                        memory: controlplanecpumemmemory + "Gi"
                    }
                };
            } else {
                /* Typed VM */
                kubevirtMachineTemplate.spec.template.spec.virtualMachineTemplate.spec.instancetype = {
                    kind: "VirtualMachineClusterInstancetype",
                    name: controlplanetype
                };
            }

            /* Placeholders */
            let devices = [];
            let disks = [];
            let dvtemplates = [];
            let networks = [];
            let interfaces = [];

            /* Create Disk From Image */
            let disk1 = {};
            let device1 = {};
            let disk1name = "disk1";
            let disk1dv: DataVolume = {
                apiVersion: "cdi.kubevirt.io/v1beta1",
                kind: "DataVolume",
                metadata: {
                    name: disk1name,
                    namespace: this.activeCluster.namespace,
                    annotations: {
                        "cdi.kubevirt.io/storage.deleteAfterCompletion": "false"
                    },
                },
                spec: {
                    pvc: {
                        storageClassName: controlplanedisksc,
                        accessModes: [ controlplanediskam ],
                        resources: {
                            requests: {
                                storage: controlplanedisksize + "Gi"
                            }
                        }
                    },
                    source: {
                        http: {
                            url: thisimageurl
                        }
                    }
                }
            };
            

            if(controlplanediskcm != "") {
                disk1 = { 'name': "disk1", 'cache': controlplanediskcm, 'disk': {} };
            } else {
                disk1 = { 'name': "disk1", 'disk': {} };
            }
            device1 = { 'name': "disk1", 'dataVolume': { 'name': disk1name } };

            dvtemplates.push(disk1dv);
            devices.push(device1);
            disks.push(disk1);

            /* Network Setup */
            let net1 = {};
            let iface1 = {};
            if(this.vmNetwork1.network != "podNetwork") {
                net1 = { 'name': "net1", 'multus': {'networkName': this.vmNetwork1.network } };
            } else {
                net1 = { 'name': "net1", 'pod': {} };
            }
            if(this.vmNetwork1.type == "bridge") {
                iface1 = { 'name': "net1", 'bridge': {} };
            } else {
                iface1 = { 'name': "net1", 'masquerade': {} };
            }
            networks.push(net1);
            interfaces.push(iface1);

            /* Disk Setup */
            if(disks.length > 0) { kubevirtMachineTemplate.spec.template.spec.virtualMachineTemplate.spec.template.spec.domain.devices.disks = disks; }
            if(devices.length > 0) { kubevirtMachineTemplate.spec.template.spec.virtualMachineTemplate.spec.template.spec.volumes = devices; }
            if(dvtemplates.length > 0) { kubevirtMachineTemplate.spec.template.spec.virtualMachineTemplate.spec.dataVolumeTemplates = dvtemplates; }

            /* Net Setup */
            if(interfaces.length > 0) { kubevirtMachineTemplate.spec.template.spec.virtualMachineTemplate.spec.template.spec.domain.devices.interfaces = interfaces; }
            if(networks.length > 0) { kubevirtMachineTemplate.spec.template.spec.virtualMachineTemplate.spec.template.spec.networks = networks; }

            try {
                let data = await lastValueFrom(this.xK8sService.deleteKubevirtMachineTemplate(kubevirtMachineTemplate.metadata.namespace, kubevirtMachineTemplate.metadata.name));
                data = await lastValueFrom(this.xK8sService.createKubevirtMachineTemplate(kubevirtMachineTemplate));
                data = await lastValueFrom(this.xK8sService.getKubevirtMachineTemplate(kubevirtMachineTemplate.metadata.namespace, kubevirtMachineTemplate.metadata.name));
                let cts = data.metadata["creationTimestamp"].toString();
                data = await lastValueFrom(this.xK8sService.rolloutKubeadmControlPlane(kubevirtMachineTemplate.metadata.namespace, kubevirtMachineTemplate.metadata.name, cts));
            } catch (e: any) {
                alert(e.error.message);
                console.log(e);
            }
        }
    }

    /*
     * Show Delete WP Window
     */
    showDeleteWp(namespace: string, name: string): void {
        let modalDiv = document.getElementById("modal-delete-wp");
        let modalTitle = document.getElementById("delete-wp-title");
        let modalBody = document.getElementById("delete-wp-value");
        if(modalTitle != null) {
            modalTitle.replaceChildren("Delete");
        }
        if(modalBody != null) {
            let wpNameInput = document.getElementById("delete-wp-name");
            let wpNamespaceInput = document.getElementById("delete-wp-namespace");
            if(wpNameInput != null && wpNamespaceInput != null) {
                wpNameInput.setAttribute("value", name);
                wpNamespaceInput.setAttribute("value", namespace);
                modalBody.replaceChildren("Are you sure you want to delete Worker Pool " + name + " on namespace: " + namespace + "?");
            }
        }
        if(modalDiv != null) {
            modalDiv.setAttribute("class", "modal fade show");
            modalDiv.setAttribute("aria-modal", "true");
            modalDiv.setAttribute("role", "dialog");
            modalDiv.setAttribute("aria-hidden", "false");
            modalDiv.setAttribute("style","display: block;");
        }
    }

    /*
     * Delete Virtual Machine Pool
     */
    async applyDeleteWp(): Promise<void> {
        let wpNameInput = document.getElementById("delete-wp-name");
        let wpNamespaceInput = document.getElementById("delete-wp-namespace");
        if(wpNameInput != null && wpNamespaceInput != null) {
            let wpName = wpNameInput.getAttribute("value");
            let wpNamespace = wpNamespaceInput.getAttribute("value");
            if(wpName != null && wpNamespace != null) {
                try {
                    let data = await lastValueFrom(this.xK8sService.deleteKubeadmConfigTemplate(wpNamespace, wpName));
                    data = await lastValueFrom(this.xK8sService.deleteKubevirtMachineTemplate(wpNamespace, wpName));
                    data = await lastValueFrom(this.xK8sService.deleteMachineDeployment(wpNamespace, wpName));
                    this.hideComponent("modal-delete");
                    this.reloadComponent();
                } catch (e: any) {
                    alert(e.error.message);
                    console.log(e);
                }
            }
        }
    }

    /*
     * Create Node Pool Objects
     */
    async createNodePoolRelatedObjects(
        nodepoolautoscaling: string,
        nodepoolname: string,
        nodepoolosdist: string,
        nodepoolosversion: string,
        nodepooltype: string,
        nodepoolcpumemsockets: string,
        nodepoolcpumemcores: string,
        nodepoolcpumemthreads: string,
        nodepoolcpumemmemory: string,
        nodepoolpc: string,
        nodepoolreplicas: string,
        nodepoolminreplicas: string,
        nodepoolmaxreplicas: string,
        nodepooldisksize: string,
        nodepooldisksc: string,
        nodepooldiskam: string,
        nodepooldiskcm: string,
    ) {

        /* PERFORM VALIDATION */
        if (nodepoolname == "") {
            alert("Please set new Node Pool name!");
        } else if(nodepooltype.toLowerCase() == "none" || nodepooltype.toLowerCase() == "") {
            alert("Please select a valid VM Type for Node Pool!");
        } else if(nodepoolosdist == "none" || nodepoolosdist == "") {
            alert("Choose an Operating System for your Node Pool!");
        } else if(nodepooldisksize == "") {
            alert("Check Node Pool disk size!");
        } else if(Number(nodepoolreplicas) == 0 || nodepoolreplicas == "") {
            alert("Please check your Node Pool replicas number!");
        } else if((nodepooltype.toLowerCase() == "custom") && (nodepoolcpumemsockets == "" || nodepoolcpumemcores == "" || nodepoolcpumemthreads == "" || nodepoolcpumemmemory == "")) {
            alert("To use Node Pool with Custom Type, you must fill in all CPU and Memory fields!");
        } else {

            /* Local values */
            let name = this.activeCluster.name;
            let namespace = this.activeCluster.namespace;
            let version = this.activeCluster.controlPlane.version;
            let nodepoolosimageurl = this.getImageUrl(version, nodepoolosdist, nodepoolosversion).toString();

            /* Custom Labels */
            let tmpLabels = {};
            let machineTemplateLabels = {};
            let machineDeploymentAnnotations = {};

            /* Load other labels */
            let thisLabel = { [this.myConstants.KubevirtManagerCluster]: name };
            Object.assign(tmpLabels, thisLabel);
            Object.assign(machineTemplateLabels, thisLabel)

            let kubevirtManagerLabel = { [this.myConstants.KubevirtManagerManaged]: "true" };
            Object.assign(tmpLabels, kubevirtManagerLabel);
            Object.assign(tmpLabels, { [this.myConstants.KubevirtManagerClusterAutoscaler]: nodepoolautoscaling });

            
            /* Machine Labels */
            Object.assign(machineTemplateLabels, { [this.myConstants.KubevirtManagerCluster]: name });
            Object.assign(machineTemplateLabels, { [this.myConstants.KubevirtManagerManaged]: "true" });
            Object.assign(machineTemplateLabels, { [this.myConstants.KubevirtManagerClusterFlavor]: nodepoolosdist });
            Object.assign(machineTemplateLabels, { [this.myConstants.KubevirtManagerClusterFlavorVersion]: nodepoolosversion });
            Object.assign(machineTemplateLabels, { [this.myConstants.KubevirtManagerClusterKubernetesVersion] : version });
            Object.assign(machineTemplateLabels, { [this.myConstants.KubevirtDomain]: name + "-" + nodepoolname });

            /* MachineDeployment Annotations */
            if(nodepoolautoscaling == "true") {
                Object.assign(machineDeploymentAnnotations, { [this.myConstants.KubevirtManagerClusterAutoscalerMin]: nodepoolminreplicas });
                Object.assign(machineDeploymentAnnotations, { [this.myConstants.KubevirtManagerClusterAutoscalerMax]: nodepoolmaxreplicas });
            }

            /* KubeadmConfig */
            let kubeadmConfigTemplate: KubeadmConfigTemplate = {
                apiVersion: "bootstrap.cluster.x-k8s.io/v1beta1",
                kind: "KubeadmConfigTemplate",
                metadata: {
                    name: name + "-" + nodepoolname,
                    namespace: namespace,
                    labels: tmpLabels
                },
                spec: {
                    template: {
                        metadata: {
                            labels: tmpLabels
                        },
                        spec: {
                            joinConfiguration: {
                                nodeRegistration: {
                                    kubeletExtraArgs: {}
                                }
                            },
                            useExperimentalRetryJoin: true,
                            format: "cloud-config"
                        }
                    }
                }
            };

            /* Add ignition support for flatcar */
            if (nodepoolosdist == "flatcar") {
                kubeadmConfigTemplate.spec.template.spec.format = "ignition";
            }

            /* MachineDeployment */
            let machineDeployment: MachineDeployment = {
                apiVersion: "cluster.x-k8s.io/v1beta1",
                kind: "MachineDeployment",
                metadata: {
                    name: name + "-" + nodepoolname,
                    namespace: namespace,
                    labels: tmpLabels,
                    annotations: machineDeploymentAnnotations
                },
                spec: {
                    clusterName: name,
                    replicas: Number(nodepoolreplicas),
                    selector: {},
                    template: {
                        metadata: {
                            labels: tmpLabels
                        },
                        spec: {
                            bootstrap: {
                                configRef: {
                                    apiVersion: "bootstrap.cluster.x-k8s.io/v1beta1",
                                    kind: "KubeadmConfigTemplate",
                                    name: name + "-" + nodepoolname,
                                    namespace: namespace
                                }
                            },
                            clusterName: name,
                            infrastructureRef: {
                                apiVersion: "infrastructure.cluster.x-k8s.io/v1alpha1",
                                kind: "KubevirtMachineTemplate",
                                name: name + "-" + nodepoolname,
                                namespace: namespace
                            },
                            version: version
                        }
                    }
                }
            };

            /* 
            * Kubevirt Machine Template
            */

            let kubevirtMachineTemplate: KubevirtMachineTemplate = {
                apiVersion: "infrastructure.cluster.x-k8s.io/v1alpha1",
                kind: "KubevirtMachineTemplate",
                metadata: {
                    name: name + "-" + nodepoolname,
                    namespace: namespace,
                    labels: machineTemplateLabels
                },
                spec: {
                    template: {
                        spec: {
                            virtualMachineTemplate: {
                                metadata: {
                                    namespace: namespace,
                                    labels: machineTemplateLabels
                                },
                                spec: {
                                    dataVolumeTemplates: {},
                                    runStrategy: "Once",
                                    template: {
                                        metadata: {
                                            labels: machineTemplateLabels
                                        },
                                        spec: {
                                            priorityClassName: nodepoolpc,
                                            domain: {
                                                devices: {
                                                    disks: {},
                                                    interfaces: {},
                                                    networkInterfaceMultiqueue: true
                                                }
                                            },
                                            networks: {},
                                            volumes: {}
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            };

            /* Check Node Pool VM Type */
            if(nodepooltype.toLowerCase() == "custom") {
                /* Custom VM */
                kubevirtMachineTemplate.spec.template.spec.virtualMachineTemplate.spec.template.spec.domain.cpu = {
                    cores: Number(nodepoolcpumemcores),
                    threads: Number(nodepoolcpumemthreads),
                    sockets: Number(nodepoolcpumemsockets)
                };
                kubevirtMachineTemplate.spec.template.spec.virtualMachineTemplate.spec.template.spec.domain.resources = {
                    requests: {
                        memory: nodepoolcpumemmemory + "Gi"
                    }
                };
            } else {
                /* Typed VM */
                kubevirtMachineTemplate.spec.template.spec.virtualMachineTemplate.spec.instancetype = {
                    kind: "VirtualMachineClusterInstancetype",
                    name: nodepooltype
                };
            }

            /* Placeholders */
            let devices = [];
            let disks = [];
            let dvtemplates = [];
            let networks = [];
            let interfaces = [];

            /* Create Disk From Image */
            let disk1 = {};
            let device1 = {};
            let disk1name = "disk1";
            let disk1dv: DataVolume = {
                apiVersion: "cdi.kubevirt.io/v1beta1",
                kind: "DataVolume",
                metadata: {
                    name: disk1name,
                    namespace: namespace,
                    annotations: {
                        "cdi.kubevirt.io/storage.deleteAfterCompletion": "false"
                    }
                },
                spec: {
                    pvc: {
                        storageClassName: nodepooldisksc,
                        accessModes: [ nodepooldiskam ],
                        resources: {
                            requests: {
                                storage: nodepooldisksize + "Gi"
                            }
                        }
                    },
                    source: {
                        http: {
                            url: nodepoolosimageurl
                        }
                    }
                }
            }
            dvtemplates.push(disk1dv);
            if(nodepooldiskcm != "") {
                disk1 = { 'name': "disk1", 'cache': nodepooldiskcm, 'disk': {} };
            } else {
                disk1 = { 'name': "disk1", 'disk': {}};
            }
            device1 = { 'name': "disk1", 'dataVolume': { 'name': disk1name } }
            devices.push(device1);
            disks.push(disk1);
    
            /* Network Setup */
            let net1 = {};
            let iface1 = {};
            if(this.vmNetwork1.network != "podNetwork") {
                net1 = { 'name': "net1", 'multus': {'networkName': this.vmNetwork1.network }};
            } else {
                net1 = { 'name': "net1", 'pod': {} };
            }
            if(this.vmNetwork1.type == "bridge") {
                iface1 = { 'name': "net1", 'bridge': {} };
            } else {
                iface1 = { 'name': "net1", 'masquerade': {} };
            }
            networks.push(net1);
            interfaces.push(iface1);
    
            /* Disk Setup */
            if(disks.length > 0) { kubevirtMachineTemplate.spec.template.spec.virtualMachineTemplate.spec.template.spec.domain.devices.disks = disks; }
            if(devices.length > 0) { kubevirtMachineTemplate.spec.template.spec.virtualMachineTemplate.spec.template.spec.volumes = devices; }
            if(dvtemplates.length > 0) { kubevirtMachineTemplate.spec.template.spec.virtualMachineTemplate.spec.dataVolumeTemplates = dvtemplates; }
    
            /* Net Setup */
            if(interfaces.length > 0) { kubevirtMachineTemplate.spec.template.spec.virtualMachineTemplate.spec.template.spec.domain.devices.interfaces = interfaces; }
            if(networks.length > 0) { kubevirtMachineTemplate.spec.template.spec.virtualMachineTemplate.spec.template.spec.networks = networks; }
    
    
            try {
                let data = await lastValueFrom(this.xK8sService.createKubevirtMachineTemplate(kubevirtMachineTemplate));
                data = await lastValueFrom(this.xK8sService.createKubeadmConfigTemplate(kubeadmConfigTemplate));
                data = await lastValueFrom(this.xK8sService.createMachineDeployment(machineDeployment));
            } catch (e: any) {
                console.log(e);
                alert(e.error.message);
            }
            this.hideComponent('modal-new-wp');
            this.reloadComponent();
        }
    }

    /*
     * UPDATE: Fill Distro Versions from Node Pool
     */
    async onChangeNodePoolOS(os: string): Promise<void> {
        let nodePoolOSVersionField = document.getElementById("newnodepool-osversion");
        let operatingSystemVersions = "";
        if(os == "none") {
            if(nodePoolOSVersionField != null) {
                nodePoolOSVersionField.innerHTML = operatingSystemVersions;
            }
        } else {
            for(let i = 0; i < this.clusterImageList.versions.length; i++) {
                if(this.clusterImageList.versions[i].name == this.activeCluster.controlPlane.version) {
                    for(let j = 0; j < this.clusterImageList.versions[i].flavors.length; j++) {
                        if(this.clusterImageList.versions[i].flavors[j].id == os) {
                            for(let k = 0; k < this.clusterImageList.versions[i].flavors[j].versions.length; k++) {
                                operatingSystemVersions += "<option value=" +  this.clusterImageList.versions[i].flavors[j].versions[k].id +">" + this.clusterImageList.versions[i].flavors[j].versions[k].printablename + "</option>\n";
                            }
                        }
                    }
                }
            }
            if(nodePoolOSVersionField != null) {
                nodePoolOSVersionField.innerHTML = operatingSystemVersions;
            }
        }
    }

    /*
     * Load Network Information
     */
    async loadNetInfo(interfaces: any, networks: any): Promise<void> {
        let actualNetwork = {
            name: "",
            type: "",
            network: "",
            ip: ""
        };

        for(let i = 0; i < interfaces.length; i++) {
            actualNetwork.name = interfaces[i].name;
            try {
                actualNetwork.network = networks[i].multus.networkName;
            } catch (e) {
                actualNetwork.network = "podNetwork";
            }

            try {
                if(interfaces[i].masquerade != null) {
                    actualNetwork.type = "masquerade";
                } else {
                    actualNetwork.type = "bridge";
                }
            } catch (e) {
                actualNetwork.type = "bridge";
            }
            if(i == 0) {
                try {
                    this.vmNetwork1.name = actualNetwork.name;
                    this.vmNetwork1.network = actualNetwork.network;
                    this.vmNetwork1.type = actualNetwork.type;
                } catch (e) {
                    console.log(e);
                }
            }
        }
    }

    /*
     * Node Pool Type
     */
    async onChangeNodePoolType(vmType: string) {
        let modalDiv = document.getElementById("nodepool-custom-cpu-memory");
        if(vmType.toLowerCase() == "custom") {
            if(modalDiv != null) {
                modalDiv.setAttribute("class", "modal fade show");
                modalDiv.setAttribute("aria-modal", "true");
                modalDiv.setAttribute("role", "dialog");
                modalDiv.setAttribute("aria-hidden", "false");
                modalDiv.setAttribute("style","display: contents;");
            }
        } else {
            if(modalDiv != null) {
                modalDiv.setAttribute("class", "modal fade");
                modalDiv.setAttribute("aria-modal", "false");
                modalDiv.setAttribute("role", "");
                modalDiv.setAttribute("aria-hidden", "true");
                modalDiv.setAttribute("style","display: none;");
            }
        }
    }

    /*
     * Hide Component
     */
    hideComponent(divId: string): void {
        let modalDiv = document.getElementById(divId);
        if(modalDiv != null) {
            modalDiv.setAttribute("class", "modal fade");
            modalDiv.setAttribute("aria-modal", "false");
            modalDiv.setAttribute("role", "");
            modalDiv.setAttribute("aria-hidden", "true");
            modalDiv.setAttribute("style","display: none;");
        }
    }

    /*
     * Show New Node Pool Window
     */
    async showNewNodePool(): Promise<void> {
        let i = 0;
        let clusterHash = this.randomClusterHash();
        let modalDiv = document.getElementById("modal-new-wp");
        let modalTitle = document.getElementById("new-wp-title");
        let modalBody = document.getElementById("new-wp-value");
        let nodePoolNameField = document.getElementById('newnodepool-name');
        let nodePoolOSField = document.getElementById("newnodepool-osdist");
        let selectorNPTypeField = document.getElementById("newnodepool-type");
        let selectorNPPCField = document.getElementById("newnodepool-pc");
        let selectorNPSCField = document.getElementById("newnodepool-disksc");

        /* Setting Pool Name */
        if(nodePoolNameField != null) {
            nodePoolNameField.setAttribute("value", "pool-" + clusterHash);
        }

        /* Load Operating System Versions */
        let operatingSystems = "<option value=none></option>";
        for(let i = 0; i < this.clusterImageList.versions.length; i++) {
            if(this.clusterImageList.versions[i].name == this.activeCluster.controlPlane.version) {
                /* set version */
                for(let j = 0; j < this.clusterImageList.versions[i].flavors.length; j++) {
                    operatingSystems += "<option value=" +  this.clusterImageList.versions[i].flavors[j].id +">" + this.clusterImageList.versions[i].flavors[j].name + "</option>\n";
                }
            }
        }
        if(nodePoolOSField != null) {
            nodePoolOSField.innerHTML = operatingSystems;
        }

        /* Load ClusterInstanceType List and Set Selector */
        let data = await lastValueFrom(this.kubeVirtService.getClusterInstanceTypes());
        let typeSelectorOptions = "<option value=none></option>";
        for (i = 0; i < data.items.length; i++) {
            typeSelectorOptions += "<option value=" + data.items[i].metadata["name"] +">" + data.items[i].metadata["name"] + "</option>\n";
        }
        if (selectorNPTypeField != null) {
            typeSelectorOptions += "<option value=custom>custom</option>\n";
            selectorNPTypeField.innerHTML = typeSelectorOptions;
        }

        /* Load Storage Class List and Set Selector */
        data = await lastValueFrom(this.k8sApisService.getStorageClasses());
        let storageSelectorOptions = "";
        for (i = 0; i < data.items.length; i++) {
            storageSelectorOptions += "<option value=" + data.items[i].metadata["name"] +">" + data.items[i].metadata["name"] + "</option>\n";
        }
        if (selectorNPSCField != null) {
            selectorNPSCField.innerHTML = storageSelectorOptions;
        }

        /* Load Priority Class List and Set Selector */
        data = await lastValueFrom(this.k8sApisService.getPriorityClasses());
        let prioritySelectorOptions = "";
        for (i = 0; i < data.items.length; i++) {
            if(data.items[i].metadata["name"].toLowerCase() == "vm-standard") {
                prioritySelectorOptions += "<option value=" + data.items[i].metadata["name"] +" selected>" + data.items[i].metadata["name"] + "</option>\n";
            } else {
                prioritySelectorOptions += "<option value=" + data.items[i].metadata["name"] +">" + data.items[i].metadata["name"] + "</option>\n";
            }
        }
        if (selectorNPPCField != null) {
            selectorNPPCField.innerHTML = prioritySelectorOptions;
        }

        if(modalTitle != null) {
            modalTitle.replaceChildren("New Node Pool");
        }


        if(modalDiv != null) {
            modalDiv.setAttribute("class", "modal fade show");
            modalDiv.setAttribute("aria-modal", "true");
            modalDiv.setAttribute("role", "dialog");
            modalDiv.setAttribute("aria-hidden", "false");
            modalDiv.setAttribute("style","display: block;");
        }
    }

    /*
     * Generate New Pool Random Hash
     */
    randomClusterHash(): string {
        var randomChars = 'abcdefghijklmnopqrstuvwxyz';
        var result = '';
        for ( var i = 0; i < 8; i++ ) {
            result += randomChars.charAt(Math.floor(Math.random() * randomChars.length));
        }
        return result;
    }

    /*
     * Open NoVNC
     */
    openNoVNC(namespace: string, name: string): void {
        let url = "/assets/noVNC/vnc.html?resize=scale&autoconnect=1&path=";
        let path = "/k8s/apis/subresources.kubevirt.io/v1alpha3/namespaces/" + namespace + "/virtualmachineinstances/" + name + "/vnc";
        let fullpath = url + path;
        window.open(fullpath, "kubevirt-manager.io: CONSOLE", "width=800,height=600,location=no,toolbar=no,menubar=no,resizable=yes");
    }
    
    /*
     * Reload this component
     */
    reloadComponent(): void {
        this.router.navigateByUrl('/refresh',{skipLocationChange:true}).then(()=>{
            this.router.navigate([`/kclusterdetails/${this.clusterNamespace}/${this.clusterName}`]);
        })
    }

}
