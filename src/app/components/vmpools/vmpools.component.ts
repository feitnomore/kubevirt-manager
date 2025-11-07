import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, lastValueFrom } from 'rxjs';
import { KubeVirtVMPool } from 'src/app/models/kube-virt-vmpool.model';
import { NetworkAttach } from 'src/app/models/network-attach.model';
import { DataVolumesService } from 'src/app/services/data-volumes.service';
import { K8sApisService } from 'src/app/services/k8s-apis.service';
import { K8sService } from 'src/app/services/k8s.service';
import { KubeVirtService } from 'src/app/services/kube-virt.service';
import { DataVolume } from 'src/app/interfaces/data-volume';
import { VirtualMachinePool } from 'src/app/interfaces/virtual-machine-pool';
import { Probe } from 'src/app/interfaces/probe';
import { KubevirtMgrService } from 'src/app/services/kubevirt-mgr.service';
import { FirewallLabels } from 'src/app/models/firewall-labels.model';
import { FormGroup, FormArray, FormBuilder } from '@angular/forms';
import { KubeVirtClusterInstanceType } from 'src/app/models/kube-virt-clusterinstancetype';
import { Config } from 'datatables.net';
import { Constants } from 'src/app/classes/constants';
import { Toasts } from 'src/app/classes/toasts';

@Component({
  selector: 'app-vmpools',
  templateUrl: './vmpools.component.html',
  styleUrls: ['./vmpools.component.css']
})
export class VMPoolsComponent implements OnInit {

    pageName: string = "Virtual Machine Pools";

    myConstants!: Constants;
    myToasts!: Toasts;
    crdList: any;
    poolList: KubeVirtVMPool[] = [];
    namespaceList: string[] = [];
    clusterInstanceTypeList: KubeVirtClusterInstanceType[] = [];
    netAttachList: NetworkAttach[] = [];
    networkCheck: boolean = false;
    cdiCheck: boolean = false;
    firewallLabels: FirewallLabels = new FirewallLabels;

    /*
     * Dynamic Forms
     */
    annotationList: FormGroup;
    labelList: FormGroup;
    diskList: FormGroup;
    nicList: FormGroup;

    /*
     * Dynamic Tables
     */
    vmPool_dtOptions: Config = {
        //pagingType: 'full_numbers',
        //lengthMenu: [5,10,15,25,50,100,150,200],
        //pageLength: 50,
        paging: false,
        info: false,
        ordering: true,
        orderMulti: true,
        search: true,
        destroy: false,
        stateSave: false,
        serverSide: false,
        columnDefs: [{ orderable: false, targets: 8 }],
        order: [[1, 'asc']],
    };
    vmPool_dtTrigger: Subject<any> = new Subject<any>();

    constructor(
        private router: Router,
        private k8sService: K8sService,
        private k8sApisService: K8sApisService,
        private dataVolumesService: DataVolumesService,
        private kubeVirtService: KubeVirtService,
        private kubevirtMgrService: KubevirtMgrService,
        private fb: FormBuilder
    ) {
        this.annotationList = this.fb.group({
            annotations: this.fb.array([]),
        });
        this.labelList = this.fb.group({
            labels: this.fb.array([]),
        });
        this.diskList = this.fb.group({
            disks: this.fb.array([]),
        });
        this.nicList = this.fb.group({
            nics: this.fb.array([]),
        });
    }

    async ngOnInit(): Promise<void> {
        let navTitle = document.getElementById("nav-title");
        if(navTitle != null) {
            navTitle.replaceChildren(this.pageName);
        }
        this.myConstants = new Constants();
        this.myToasts = new Toasts();
        await this.loadCrds();
        await this.getClusterInstanceTypes();
        await this.getPools();
        this.vmPool_dtTrigger.next(null);
        await this.checkNetwork();
        await this.checkCDI();
        this.annotationList = this.fb.group({
            annotations: this.fb.array([]),
        });
        this.labelList = this.fb.group({
            labels: this.fb.array([]),
        });
        this.diskList = this.fb.group({
            disks: this.fb.array([]),
        });
        this.nicList = this.fb.group({
            nics: this.fb.array([]),
        });

    }

    ngOnDestroy() {
        this.vmPool_dtTrigger.unsubscribe();
    }

    /* Getting the Annotations FormArray */
    get annotations(): FormArray {
        return this.annotationList.get('annotations') as FormArray;
    }

    /* Annotation FormGroup */
    createAnnotationGroup(): FormGroup {
        return this.fb.group({
            annotKey: [''],
            annotValue: [''],
        })
    }

    /* Add a new Annotation entry to the Group */
    addAnnotation(): void {
        this.annotations.push(this.createAnnotationGroup());
    }

    /* Remove Annotation entry from the Group */
    removeAnnotation(index: number): void {
        this.annotations.removeAt(index);
    }

    /* Getting all the annotations */
    getAnnotations(): any[] {
        return this.annotationList.value.annotations;
    }

    /*
     * Annotation Form Validation
     */
    validateAnnotations(): boolean {
        let toValidate = this.getAnnotations();
        if (toValidate.length > 0) {
            for (let i = 0; i < toValidate.length; i ++) {
                if (toValidate[i].annotKey == "" || toValidate[i].annotValue == "") {
                    alert("Annotation " + i + " should have Key and Value filled in.")
                    return false;
                } 
            }
        }
        return true;
    }

    /* Getting the Labels FormArray */
    get labels(): FormArray {
        return this.labelList.get('labels') as FormArray;
    }

    /* Label FormGroup */
    createLabelGroup(): FormGroup {
        return this.fb.group({
            labelKey: [''],
            labelValue: [''],
        });
    }

    /* Add a new Label entry to the Group */
    addLabel(): void {
        this.labels.push(this.createLabelGroup());
    }

    /* Remove Label entry from the Group */
    removeLabel(index: number): void {
        this.labels.removeAt(index);
    }

    /* Getting all the labels */
    getLabels(): any[] {
        return this.labelList.value.labels;
    }

    /*
     * Label Form Validation
     */
    validateLabels(): boolean {
        let toValidate = this.getLabels();
        if (toValidate.length > 0) {
            for (let i = 0; i < toValidate.length; i ++) {
                if (toValidate[i].labelKey == "" || toValidate[i].labelValue == "") {
                    alert("Label " + i + " should have Key and Value filled in.")
                    return false;
                }
            }
        }
        return true;
    }

    /* Getting the Disks FormArray */
    get disks(): FormArray {
        return this.diskList.get('disks') as FormArray;
    }

    /* Disk FormGroup */
    createDiskGroup(): FormGroup {
        return this.fb.group({
            diskType: [''],
            diskValue: [''],
            diskSize: [''],
            diskStorageClass: [''],
            diskAccessMode: [''],        
            diskCacheMode: [''],
        });
    }

    /* Add a new Disk entry to the Group */
    async addDisk(): Promise<void> {
        this.disks.push(this.createDiskGroup());
        let thisDiskId = this.disks.length - 1;
        await this.diskLoadStorageClasses(thisDiskId);
    }

    /* Remove Disk entry from the Group */
    removeDisk(index: number): void {
        this.disks.removeAt(index);
    }

    /* Getting all the Disks */
    getDisks(): any[] {
        return this.diskList.value.disks;
    }

    /*
     * Disk Form Validation
     */
    validateDisks(): boolean {
        let toValidate = this.getDisks();
        if (toValidate.length > 0) {
            for (let i = 0; i < toValidate.length; i ++) {
                if (toValidate[i].diskType == "") {
                    alert("Disk " + i + " has no type selected.")
                    return false;
                } else if ((toValidate[i].diskType == "blank" || toValidate[i].diskType == "image") && toValidate[i].diskSize == "") {
                    alert("Disk " + i + " has no size set.");
                    return false;
                } else if ((toValidate[i].diskType == "image" || toValidate[i].diskType == "dv") && toValidate[i].diskValue == "") {
                    alert("Disk " + i + " has no value set.");
                    return false;
                } else if (toValidate[i].diskAccessMode == "") {
                    alert("Disk " + i + " has no Access Mode set.");
                    return false;
                } else if (toValidate[i].diskStorageClass == "") {
                    alert("Disk " + i + " has no Storage Class set.");
                    return false;
                }
            }
        }
        return true;
    }

    /* Getting the NICs FormArray */
    get nics(): FormArray {
        return this.nicList.get('nics') as FormArray;
    }

    /* NIC FormGroup */
    createNicGroup(): FormGroup {
        return this.fb.group({
            networkName: [''],
            networkType: [''],
            networkDriver: [''],
        });
    }

    /* Add a new NIC entry to the Group */
    async addNic(): Promise<void> {
        this.nics.push(this.createNicGroup());
        let thisNicId = this.nics.length - 1;
        await this.loadNetworkOptions(thisNicId);
    }

    /* Remove NIC entry from the Group */
    removeNic(index: number): void {
        this.nics.removeAt(index);
    }

    /* Getting all the NICs */
    getNics(): any[] {
        return this.nicList.value.nics;
    }

    /*
     * NIC Form Validation
     */
    validateNics(): boolean {
        let toValidate = this.getNics();
        if (toValidate.length > 0) {
            for (let i = 0; i < toValidate.length; i ++) {
                if (toValidate[i].networkName == "") {
                    alert("NIC " + i + " has no Network selected.")
                    return false;
                } else if (toValidate[i].networkType == "") {
                    alert("NIC " + i + " has no Type selected.");
                    return false;
                }
            }
        }
        return true;
    }

    /*
     * Load Pool List
     */
    async getPools(): Promise<void> {
        this.poolList = [];
        let currentPool = new KubeVirtVMPool;
        const data = await lastValueFrom(this.kubeVirtService.getVMPools());
        let pools = data.items;
        for(let i = 0; i < pools.length; i++) {
            currentPool = new KubeVirtVMPool();
            currentPool.name = pools[i].metadata["name"];
            currentPool.namespace = pools[i].metadata["namespace"];
            currentPool.creationTimestamp = new Date(pools[i].metadata["creationTimestamp"]);
            currentPool.replicas = pools[i].spec["replicas"];

            /* Getting VM Type */
            try {
                currentPool.instType = pools[i].spec.virtualMachineTemplate.spec.instancetype.name;
            } catch(e: any) {
                currentPool.instType = "custom";
                console.log(e);
            }

            try {
                currentPool.runStrategy = pools[i].spec.virtualMachineTemplate.spec["runStrategy"];
            } catch (e: any) {
                currentPool.runStrategy = "";
                console.log("Error loading Pool runStrategy");
            }

            /* Getting Ready Replicas */
            if(pools[i].status["readyReplicas"] != null) {
                try {
                    currentPool.readyReplicas = Number(pools[i].status["readyReplicas"]);
                    currentPool.running = true;
                } catch (e: any) {
                    currentPool.running = false;
                    currentPool.readyReplicas = 0;
                    console.log(e);
                }
            } else {
                currentPool.running = false;
            }

            if(currentPool.instType == "custom") {
                /* Custom VM has cpu / mem parameters */
                currentPool.cores = pools[i].spec.virtualMachineTemplate.spec.template.spec.domain.cpu["cores"];
                currentPool.sockets = pools[i].spec.virtualMachineTemplate.spec.template.spec.domain.cpu["sockets"];
                currentPool.threads = pools[i].spec.virtualMachineTemplate.spec.template.spec.domain.cpu["threads"];
                currentPool.memory = pools[i].spec.virtualMachineTemplate.spec.template.spec.domain.resources.requests["memory"];
            } else {
                /* load vCPU / Mem from type */
                for(let j = 0; j < this.clusterInstanceTypeList.length; j++) {
                    if(this.clusterInstanceTypeList[j].name == currentPool.instType) {
                        currentPool.cores = this.clusterInstanceTypeList[j].cores;
                        currentPool.memory = this.clusterInstanceTypeList[j].memory;
                        currentPool.sockets = this.clusterInstanceTypeList[j].sockets;
                        currentPool.threads = this.clusterInstanceTypeList[j].threads;
                    }
                }
            }
            this.poolList.push(currentPool);
        }
    }

    /*
     * Load Instance Types
     */
    async getClusterInstanceTypes(): Promise<void> {
        let currentClusterInstanceType = new KubeVirtClusterInstanceType;
        try {
            const datacit = await lastValueFrom(this.kubeVirtService.getClusterInstanceTypes());
            let cits = datacit.items;
            for (let i = 0; i < cits.length; i++) {
                currentClusterInstanceType = new KubeVirtClusterInstanceType();
                try {
                    currentClusterInstanceType.name = cits[i].metadata.name;
                    currentClusterInstanceType.cores = cits[i].spec.cpu["guest"];
                    currentClusterInstanceType.memory = cits[i].spec.memory["guest"];
                    currentClusterInstanceType.sockets = 1;
                    currentClusterInstanceType.threads = 1;
                } catch (e: any) {
                    currentClusterInstanceType.sockets = 0;
                    currentClusterInstanceType.threads = 0;
                    currentClusterInstanceType.cores = 0;
                    currentClusterInstanceType.memory = "";
                }
                this.clusterInstanceTypeList.push(currentClusterInstanceType);
            }
        } catch (e: any) {
            console.log("ERROR Retrieving ClusterInstanceType list");
        }
    }

    /*
     * Show New Pool Window
     */
    async showNewPool(): Promise<void> {
        let i = 0;
        let modalDiv = document.getElementById("modal-newpool");
        let modalTitle = document.getElementById("newpool-title");
        let modalBody = document.getElementById("newpool-value");

        let selectorNamespacesField = document.getElementById("newpool-namespace");
        let selectorTypeField = document.getElementById("newpool-type");
        let selectorPCField = document.getElementById("newpool-pc");
        let selectorSCOneField = document.getElementById("newpool-diskonesc");
        let selectorSCTwoField = document.getElementById("newpool-disktwosc");

        let data: any;

        /* Load Namespace List and Set Selector */
        let nsSelectorOptions = "";
        try {
            data = await lastValueFrom(this.k8sService.getNamespaces());
            for (i = 0; i < data.items.length; i++) {
                this.namespaceList.push(data.items[i].metadata["name"]);
                nsSelectorOptions += "<option value=" + data.items[i].metadata["name"] +">" + data.items[i].metadata["name"] + "</option>\n";
            }
        } catch (e: any) {
            console.log(e);
        }

        /* Show new window
         * to avoid delays
         */
        if(modalTitle != null) {
            modalTitle.replaceChildren("New Virtual Machine Pool");
        }
        if(modalDiv != null) {
            modalDiv.setAttribute("class", "modal fade show");
            modalDiv.setAttribute("aria-modal", "true");
            modalDiv.setAttribute("role", "dialog");
            modalDiv.setAttribute("aria-hidden", "false");
            modalDiv.setAttribute("style","display: block;");
        }


        /* Load ClusterInstanceType List and Set Selector */
        let typeSelectorOptions = "<option value=none></option>";
        try {
            data = await lastValueFrom(this.kubeVirtService.getClusterInstanceTypes());
            for (i = 0; i < data.items.length; i++) {
                typeSelectorOptions += "<option value=" + data.items[i].metadata["name"] +">" + data.items[i].metadata["name"] + "</option>\n";
            }
        } catch (e: any) {
            console.log(e);
        }

        /* Load Storage Class List and Set Selector */
        let storageSelectorOptions = "";
        try {
            data = await lastValueFrom(this.k8sApisService.getStorageClasses());
            for (i = 0; i < data.items.length; i++) {
                storageSelectorOptions += "<option value=" + data.items[i].metadata["name"] +">" + data.items[i].metadata["name"] + "</option>\n";
            }
        } catch (e: any) {
            console.log(e);
        }

        /* Load Priority Class List and Set Selector */
        let prioritySelectorOptions = "";
        try {
            data = await lastValueFrom(this.k8sApisService.getPriorityClasses());
            for (i = 0; i < data.items.length; i++) {
                if(data.items[i].metadata["name"].toLowerCase() == "vm-standard") {
                    prioritySelectorOptions += "<option value=" + data.items[i].metadata["name"] +" selected>" + data.items[i].metadata["name"] + "</option>\n";
                } else {
                    prioritySelectorOptions += "<option value=" + data.items[i].metadata["name"] +">" + data.items[i].metadata["name"] + "</option>\n";
                }
            }
        } catch (e: any) {
            console.log(e);
        }

        if (selectorNamespacesField != null) {
            selectorNamespacesField.innerHTML = nsSelectorOptions;
        }

        if (selectorTypeField != null) {
            typeSelectorOptions += "<option value=custom>custom</option>\n";
            selectorTypeField.innerHTML = typeSelectorOptions;
        }

        if (selectorSCOneField != null && selectorSCTwoField != null) {
            selectorSCOneField.innerHTML = storageSelectorOptions;
            selectorSCTwoField.innerHTML = storageSelectorOptions;
        }

        if (selectorPCField != null) {
            selectorPCField.innerHTML = prioritySelectorOptions;
        }

    }

    /*
     * New VM: Create the New VM
     */
    async applyNewPool(
        newpoolname: string,
        newpoolnamespace: string,
        newpoolreplicas: string,
        newpooltype: string,
        newpoolcpumemsockets: string,
        newpoolcpumemcores: string,
        newpoolcpumemthreads: string,
        newpoolcpumemmemory: string,
        newpoolpriorityclass: string,
        newpoolfirmware: string,
        newpoolsecureboot: string,
        newpoollivenessenable: string,
        newpoollivenesstype: string,
        newpoollivenesspath: string,
        newpoollivenessport: string,
        newpoollivenessinitialdelay: string,
        newpoollivenessinterval: string,
        newpoollivenesstimeout: string,
        newpoollivenessfailure: string,
        newpoollivenesssuccess: string,
        newpoolreadinessenable: string,
        newpoolreadinesstype: string,
        newpoolreadinesspath: string,
        newpoolreadinessport: string,
        newpoolreadinessinitialdelay: string,
        newpoolreadinessinterval: string,
        newpoolreadinesstimeout: string,
        newpoolreadinessfailure: string,
        newpoolreadinesssuccess: string,
        newpooluserdatausername: string,
        newpooluserdataauth: string,
        newpooluserdatapassword: string,
        newpooluserdatassh: string,
        newpoolinitscript: string
    ) {
        /* Basic Form Fields Check/Validation */
        if(newpoolname == "" || newpoolnamespace == "") {
            alert("You need to fill in the name and namespace fields!");
        } else if(this.checkPoolExists(newpoolname, newpoolnamespace)) {
            alert("Pool with name/namespace combination already exists!");
        } else if(newpooltype.toLowerCase() == "none" || newpooltype.toLowerCase() == "") {
            alert("Please select a valid VM type!");
        } else if(newpoollivenessenable == "true" && (newpoollivenessport == "" || newpoollivenessinitialdelay == "" ||  newpoollivenessinterval == "" || newpoollivenesstimeout == "" || newpoollivenessfailure == "" || newpoollivenesssuccess == "")) {
            alert("You need to enter all the Liveness Probe details!");
        } else if (newpoollivenessenable == "true" && newpoollivenesstype == "http" && newpoollivenesspath == "") {
            alert("You need to enter HTTP Path details on the Liveness Probe tab!");
        } else if(newpoolreadinessenable == "true" && (newpoolreadinessport == "" || newpoolreadinessinitialdelay == "" ||  newpoolreadinessinterval == "" || newpoolreadinesstimeout == "" || newpoolreadinessfailure == "" || newpoolreadinesssuccess == "")) {
            alert("You need to enter all the Readiness Probe details!");
        } else if (newpoolreadinessenable == "true" && newpoolreadinesstype == "http" && newpoolreadinesspath == "") {
            alert("You need to enter HTTP Path details on the Readiness Probe tab!");
        } else if(this.validateAnnotations() && this.validateLabels() && this.validateDisks() && this.validateNics()) {

            /* Initial Descriptor */
            let thisVirtualMachinePool: VirtualMachinePool = {
                apiVersion: "pool.kubevirt.io/v1alpha1",
                kind: "VirtualMachinePool",
                metadata: {
                    name: newpoolname,
                    namespace: newpoolnamespace
                },
                spec: {
                    replicas: Number(newpoolreplicas),
                    selector: {
                        matchLabels: {}
                    },
                    virtualMachineTemplate: {
                        metadata: {},
                        spec: {
                            dataVolumeTemplates: {},
                            runStrategy: "Always",
                            template: {
                                metadata: {},
                                spec: {
                                    domain: {
                                        devices: {
                                            disks: {},
                                            interfaces: {},
                                            networkInterfaceMultiqueue: true
                                        },
                                    },
                                    priorityClassName: newpoolpriorityclass,
                                    networks: {},
                                    volumes: {}
                                }
                            }
                        }
                    }
                }
            };

            /* Load Custom Labels OPTIONAL */
            let labelsForm = this.getLabels();
            let tmpLabels = {};
            for (let i = 0; i < labelsForm.length; i++) {
                let thisLabel = {
                    [labelsForm[i].labelKey.toString()] : labelsForm[i].labelValue
                };
                Object.assign(tmpLabels, thisLabel);
            }

            /* Load Annotations OPTIONAL */
            let annotationsForm = this.getAnnotations();
            let tmpAnnotations = {};
            for (let i = 0; i < annotationsForm.length; i++) {
                let thisAnnotation = {
                    [annotationsForm[i].annotKey.toString()] : annotationsForm[i].annotValue
                };
                Object.assign(tmpAnnotations, thisAnnotation);
            }

            /* Populate our Pool with our Labels */
            Object.assign(tmpLabels, { [this.myConstants.KubevirtVmPool]: newpoolname });
            Object.assign(tmpLabels, { [this.myConstants.KubevirtManagerManaged]: "true" });
            Object.assign(tmpLabels, { [this.firewallLabels.VirtualMachinePool]: newpoolname });

            /* Populate our Pool with our Labels */
            thisVirtualMachinePool.metadata.labels = tmpLabels;
            thisVirtualMachinePool.spec.selector.matchLabels = tmpLabels;
            thisVirtualMachinePool.spec.virtualMachineTemplate.metadata.labels = tmpLabels;
            thisVirtualMachinePool.spec.virtualMachineTemplate.spec.template.metadata.labels = tmpLabels;

            /* Load Annotations */
            thisVirtualMachinePool.metadata.annotations = tmpAnnotations;
            thisVirtualMachinePool.spec.virtualMachineTemplate.metadata.annotations = tmpAnnotations;
            thisVirtualMachinePool.spec.virtualMachineTemplate.spec.template.metadata.annotations = tmpAnnotations;

            /* Check VM Type */
            if(newpooltype.toLowerCase() == "custom") {
                if(newpoolcpumemsockets == "" || newpoolcpumemcores == "" || newpoolcpumemthreads == "" || newpoolcpumemmemory == "") {
                    alert("For custom VM you need to set cpu and memory parameters!");
                    throw new Error("For custom VM you need to set cpu and memory parameters!");
                } else {
                    /* Custom VM */
                    thisVirtualMachinePool.spec.virtualMachineTemplate.spec.template.spec.domain.cpu = {
                        cores: Number(newpoolcpumemcores),
                        threads: Number(newpoolcpumemthreads),
                        sockets: Number(newpoolcpumemsockets)
                    };
                    thisVirtualMachinePool.spec.virtualMachineTemplate.spec.template.spec.domain.resources = {
                        requests: {
                            memory: newpoolcpumemmemory + "Gi"
                        }
                    };
                }
            } else {
                /* Typed VM */
                thisVirtualMachinePool.spec.virtualMachineTemplate.spec.instancetype = {
                    kind: 'VirtualMachineClusterInstancetype',
                    name: newpooltype
                };
            }

            /* Our Arrays */
            let networks = [];
            let disks = [];
            let interfaces = [];
            let volumes = [];
            let dvtemplates = [];

            let cloudconfig  = "#cloud-config\n";
                cloudconfig += "manage_etc_hosts: true\n";

            let netconfig  ="version: 1\n";
                netconfig += "config:\n";
                netconfig += "    - type: physical\n";
                netconfig += "      name: enp1s0\n";
                netconfig += "      subnets:\n";
                netconfig += "      - type: dhcp\n";


            /* Disk setup */
            let thisDiskList = this.getDisks();
            for(let i = 0; i < thisDiskList.length; i++) {
                let diskObject = {};
                let deviceObject = {};
                let actualDisk = thisDiskList[i];
                let actualDiskName = newpoolnamespace + "-"+ newpoolname + "-disk" + i.toString();
                let diskDataVolume: DataVolume = {
                    apiVersion: "cdi.kubevirt.io/v1beta1",
                    kind: "DataVolume",
                    metadata: {
                        name: actualDiskName,
                        namespace: newpoolnamespace,
                        annotations: {
                            "cdi.kubevirt.io/storage.deleteAfterCompletion": "false",
                        }
                    },
                    spec: {
                        pvc: {
                            storageClassName: actualDisk.diskStorageClass,
                            accessModes:[
                                actualDisk.diskAccessMode
                            ],
                            resources: {
                                requests: {
                                    storage: actualDisk.diskSize + "Gi",
                                }
                            }
                        },
                        source: {}
                    }
                }

                if(actualDisk.diskType == "image") {
                    try {
                        let imageData = await lastValueFrom(await this.kubevirtMgrService.getImage(newpoolnamespace, actualDisk.diskValue));
                        switch(imageData.spec.type) {
                            case "http":
                                diskDataVolume.spec.source = {
                                    http: {
                                        url: imageData.spec.http.url
                                    }
                                }
                                break;
                            case "gcs":
                                diskDataVolume.spec.source = {
                                    gcs: {
                                        url: imageData.spec.gcs.url
                                    }
                                }
                                break;
                            case "s3":
                                diskDataVolume.spec.source = {
                                    s3: {
                                        url: imageData.spec.s3.url
                                    }
                                }
                                break;
                            case "registry":
                                diskDataVolume.spec.source = {
                                    registry: {
                                        url: imageData.spec.registry.url
                                    }
                                }
                                break;
                            case "pvc":
                                diskDataVolume.spec.source = {
                                    pvc: {
                                        name: imageData.spec.pvc.name,
                                        namespace: imageData.spec.pvc.namespace
                                    }
                                }
                                break;
                        }
                    } catch (e: any) {
                        this.myToasts.toastError(this.pageName, "", e.message)
                        console.log(e);
                        throw new Error("Error loading disk" + i + " image data!");
                    }
                    if(actualDisk.diskCacheMode != "") {
                        diskObject = { 'name': "disk" + i.toString(), 'cache': actualDisk.diskCacheMode, 'disk': {}};
                    } else {
                        diskObject = { 'name': "disk" + i.toString(), 'disk': {}};
                    }
                    deviceObject = { 'name': "disk" + i.toString(), 'dataVolume': { 'name': actualDiskName}};
                } else if (actualDisk.diskType == "blank") {
                    diskDataVolume.spec.source = {
                        blank: {}
                    }
                    if(actualDisk.diskCacheMode != "") {
                        diskObject = { 'name': "disk" + i.toString(), 'cache': actualDisk.diskCacheMode, 'disk': {}};
                    } else {
                        diskObject = { 'name': "disk" + i.toString(), 'disk': {}};
                    }
                    deviceObject = { 'name': "disk" + i.toString(), 'dataVolume': { 'name': actualDiskName}};
                } else if (actualDisk.diskType == "dv") {
                    /* Use Existing DataVolume */
                    if(actualDisk.diskCacheMode != "") {
                        diskObject = { 'name': "disk" + i.toString(), 'cache': actualDisk.diskCacheMode, 'disk': {}};
                    } else {
                        diskObject = { 'name': "disk" + i.toString(), 'disk': {}};
                    }
                    deviceObject = { 'name': "disk" + i.toString(), 'dataVolume': { 'name': actualDisk.diskValue }};
                }
                volumes.push(deviceObject);
                disks.push(diskObject);
                dvtemplates.push(diskDataVolume);
            }

            /* UserData Setup */
            if(newpooluserdatausername != "") {
                cloudconfig += "user: " + newpooluserdatausername + "\n";
                Object.assign(thisVirtualMachinePool.metadata.labels, { [this.myConstants.KubevirtManagerCloudInit] : newpooluserdatausername });
                Object.assign(thisVirtualMachinePool.spec.virtualMachineTemplate.metadata.labels, { [this.myConstants.KubevirtManagerCloudInit] : newpooluserdatassh });
                Object.assign(thisVirtualMachinePool.spec.virtualMachineTemplate.spec.template.metadata.labels, { [this.myConstants.KubevirtManagerCloudInit] : newpooluserdatassh });
            }
            if(newpooluserdataauth.toLowerCase() == "ssh") {
                if (newpooluserdatassh != "") {
                    let sshLabels = {};
                    Object.assign(sshLabels, { [this.myConstants.KubevirtManagerSsh] : "true" });
                    Object.assign(sshLabels, { [this.myConstants.KubevirtManagerCloudInitSsh] : newpooluserdatassh});
                    Object.assign(thisVirtualMachinePool.metadata.labels, sshLabels);
                    Object.assign(thisVirtualMachinePool.spec.virtualMachineTemplate.metadata.labels, sshLabels);
                    Object.assign(thisVirtualMachinePool.spec.virtualMachineTemplate.spec.template.metadata.labels, sshLabels);
                    try {
                        let sshSecret = await lastValueFrom(this.k8sService.getSecret(newpoolnamespace, newpooluserdatassh));
                        let sshKey = sshSecret.data["ssh-privatekey"];
                        cloudconfig += "ssh_authorized_keys:\n";
                        cloudconfig += "  - " + atob(sshKey) + "\n";
                    } catch (e: any) {
                        this.myToasts.toastError(this.pageName, "", e.message);
                        console.log(e);
                    }
                }
            } else {
                if (newpooluserdatapassword != "") {
                    cloudconfig += "password: " + newpooluserdatapassword + "\n";
                }
            }

            /* Init Script Setup */
            if(newpoolinitscript != "") {
                cloudconfig += "runcmd: \n";
                for (const line of newpoolinitscript.split(/[\r\n]+/)){
                    cloudconfig += "  - " + line + "\n";
                }
            }

            /* Adding UserData/NetworkData device */
            let diskUserData = {'name': "disk" + this.disks.length.toString(), 'disk': {'bus': "virtio"}};
            let deviceUserData = {'name': "disk" + this.disks.length.toString(), 'cloudInitNoCloud': {'userData': cloudconfig, 'networkData': netconfig}};
            volumes.push(deviceUserData);
            disks.push(diskUserData);

            /* NICs Setup */
            let thisNICList = this.getNics();
            for(let i = 0; i < thisNICList.length; i++) {
                /* networkName, networkType */
                let thisNIC = thisNICList[i];
                let netObject = {};
                let ifaceObject = {};
                if(thisNIC.networkName != "podNetwork") {
                    netObject = {'name': "net" + i.toString(), 'multus': {'networkName': thisNIC.networkName}};
                    let network_split = thisNIC.networkName.split("/")
                    if(i > 0) {
                        let theseNetworks: string[] = [];
                        theseNetworks.push(network_split[1])
                        for(let j = 0; j < i; j++) {
                            let otherNIC = thisNICList[j];
                            if(otherNIC.networkName != "podNetwork") {
                                let othernic_network_split = otherNIC.networkName.split("/")
                                if (othernic_network_split[1] !== undefined) {
                                    theseNetworks.push(othernic_network_split[1]);
                                }
                            }
                        }
                        if (theseNetworks.length > 0) {
                            Object.assign(thisVirtualMachinePool.metadata.labels, { [this.myConstants.KubernetesCniNetworks]: theseNetworks.join(".") });
                            Object.assign(thisVirtualMachinePool.spec.virtualMachineTemplate.metadata.labels, { [this.myConstants.KubernetesCniNetworks]: theseNetworks.join(".") });
                            Object.assign(thisVirtualMachinePool.spec.virtualMachineTemplate.spec.template.metadata.labels, { [this.myConstants.KubernetesCniNetworks]: theseNetworks.join(".") });
                        } else {
                            Object.assign(thisVirtualMachinePool.metadata.labels, { [this.myConstants.KubernetesCniNetworks]: network_split[1] });
                            Object.assign(thisVirtualMachinePool.spec.virtualMachineTemplate.metadata.labels, { [this.myConstants.KubernetesCniNetworks]: network_split[1] });
                            Object.assign(thisVirtualMachinePool.spec.virtualMachineTemplate.spec.template.metadata.labels, { [this.myConstants.KubernetesCniNetworks]: network_split[1] });
                        }
                    } else {
                        Object.assign(thisVirtualMachinePool.metadata.labels, { [this.myConstants.KubernetesCniNetworks]: network_split[1] });
                        Object.assign(thisVirtualMachinePool.spec.virtualMachineTemplate.metadata.labels, { [this.myConstants.KubernetesCniNetworks]: network_split[1] });
                        Object.assign(thisVirtualMachinePool.spec.virtualMachineTemplate.spec.template.metadata.labels, { [this.myConstants.KubernetesCniNetworks]: network_split[1] });
                    }
                } else {
                    netObject = {'name': "net" + i.toString(), 'pod': {}};
                }

                let nicDriver = "virtio"
                if(thisNIC.networkDriver != "") {
                    nicDriver = thisNIC.networkDriver
                }
                
                if(thisNIC.networkType == "bridge") {
                    ifaceObject = {'name': "net" + i.toString(), 'bridge': {}, 'model': nicDriver}; 
                } else if(thisNIC.networkType == "macvtap") {
                    ifaceObject = {'name': "net" + i.toString(), 'binding': {'name': 'macvtap'}, 'model': nicDriver};
                } else {
                    ifaceObject = {'name': "net" + i.toString(), 'masquerade': {}, 'model': nicDriver};
                }
                networks.push(netObject);
                interfaces.push(ifaceObject);
            }

            /* Firmware and Secure Boot */
            if(newpoolfirmware.toLowerCase() == "bios") {
                let firmware = { 'bootloader': { 'bios': {}}};
                thisVirtualMachinePool.spec.virtualMachineTemplate.spec.template.spec.domain.firmware = firmware;
            } else if (newpoolfirmware.toLowerCase() == "uefi") {
                let firmware = {};
                if(newpoolsecureboot == "true") {
                    firmware = { 'bootloader': { 'efi': { 'secureBoot': true }}};
                } else {
                    firmware = { 'bootloader': { 'efi': { 'secureBoot': false }}};
                }
                let features = { 'smm': { 'enabled': true }};
                thisVirtualMachinePool.spec.virtualMachineTemplate.spec.template.spec.domain.firmware = firmware;
                thisVirtualMachinePool.spec.virtualMachineTemplate.spec.template.spec.domain.features = features;
            } else {
                let firmware = { 'bootloader': { 'bios': {}}};
                thisVirtualMachinePool.spec.virtualMachineTemplate.spec.template.spec.domain.firmware = firmware;
            }

            /* Assigning Arrays */
            if(networks.length > 0) { thisVirtualMachinePool.spec.virtualMachineTemplate.spec.template.spec.networks = networks; }
            if(interfaces.length > 0) { thisVirtualMachinePool.spec.virtualMachineTemplate.spec.template.spec.domain.devices.interfaces = interfaces; }
            if(dvtemplates.length > 0) { thisVirtualMachinePool.spec.virtualMachineTemplate.spec.dataVolumeTemplates = dvtemplates }
            if(disks.length > 0) { thisVirtualMachinePool.spec.virtualMachineTemplate.spec.template.spec.domain.devices.disks = disks }
            if(volumes.length > 0) { thisVirtualMachinePool.spec.virtualMachineTemplate.spec.template.spec.volumes = volumes }

            /* Liveness Probe Setup */
            if(newpoollivenessenable == "enabled") {
                let livenessProbe: Probe = {
                    initialDelaySeconds: Number(newpoollivenessinitialdelay),
                    periodSeconds: Number(newpoollivenessinterval),
                    timeoutSeconds: Number(newpoollivenesstimeout),
                    failureThreshold: Number(newpoollivenessfailure),
                    successThreshold: Number(newpoollivenesssuccess)                
                };
                /* Adjusting our Probe */
                if(newpoollivenesstype.toLowerCase() == "http") {
                    let httpProbe = {
                        path: newpoollivenesspath,
                        port: Number(newpoollivenessport)
                    };
                    livenessProbe.httpGet = httpProbe;
                } else {
                    let tcpProbe = {
                        port: Number(newpoollivenessport)
                    };
                    livenessProbe.tcpSocket = tcpProbe;
                }

                /* Assigning to our object */
                thisVirtualMachinePool.spec.virtualMachineTemplate.spec.template.spec.livenessProbe = livenessProbe;
            }

            /* Readiness Probe Setup */
            if(newpoolreadinessenable == "enabled") {
                let readinessProbe: Probe = {
                    initialDelaySeconds: Number(newpoolreadinessinitialdelay),
                    periodSeconds: Number(newpoolreadinessinterval),
                    timeoutSeconds: Number(newpoolreadinesstimeout),
                    failureThreshold: Number(newpoolreadinessfailure),
                    successThreshold: Number(newpoolreadinesssuccess)                
                };
                /* Adjusting our Probe */
                if(newpoolreadinesstype.toLowerCase() == "http") {
                    let httpProbe = {
                        path: newpoolreadinesspath,
                        port: Number(newpoolreadinessport)
                    };
                    readinessProbe.httpGet = httpProbe;
                } else {
                    let tcpProbe = {
                        port: Number(newpoolreadinessport)
                    };
                    readinessProbe.tcpSocket = tcpProbe;
                }

                /* Assigning to our object */
                thisVirtualMachinePool.spec.virtualMachineTemplate.spec.template.spec.readinessProbe = readinessProbe;
            }

            /* Create the Pool */
            try {
                let data = await lastValueFrom(this.kubeVirtService.createPool(thisVirtualMachinePool));
                this.hideComponent("modal-newpool");
                this.myToasts.toastSuccess(this.pageName, "", "Created Virtual Machine Pool: " + newpoolname);
                this.fullReload();
            } catch (e: any) {
                this.myToasts.toastError(this.pageName, "", e.message);
                console.log(e);
            }
        }
    }

    /*
     * New Pool: Change Firmware
     */
    async onChangeFirmware(firmware: string) {
        let secureBootValueField = document.getElementById("newpool-secureboot");
        if(firmware == "uefi") {
            if (secureBootValueField != null) {
                secureBootValueField.removeAttribute("disabled");
            }
        } else if (firmware == "bios") {
            if (secureBootValueField != null) {
                secureBootValueField.setAttribute("disabled", "disabled");
            }
        }
    }

    /*
     * VM Basic Operations (start, stop, etc...)
     */
    async vmOperations(vmOperation: string, vmNamespace: string, vmName: string): Promise<void> {
        if(vmOperation == "start"){
            var data = await lastValueFrom(this.kubeVirtService.startVm(vmNamespace, vmName));
            this.myToasts.toastSuccess(this.pageName, "", "Started: " + vmName);
            this.fullReload();
        } else if (vmOperation == "stop") {
            var data = await lastValueFrom(this.kubeVirtService.stopVm(vmNamespace, vmName));
            this.myToasts.toastSuccess(this.pageName, "", "Stopped: " + vmName);
            this.fullReload();
        } else if (vmOperation == "reboot"){
            var data = await lastValueFrom(this.kubeVirtService.restartVm(vmNamespace, vmName));
            this.myToasts.toastSuccess(this.pageName, "", "Restared: " + vmName);
            this.fullReload();
        } else if (vmOperation == "delete") {
            const data = await lastValueFrom(this.kubeVirtService.deleteVm(vmNamespace, vmName));
            this.myToasts.toastSuccess(this.pageName, "", "Deleted: " + vmName);
            this.fullReload();
        }
    }

    /*
     * Remove VM From Pool
     */
    async removeVmFromPool(vmNamespace: string, vmName: string, vmNode: string) {
        try {
            const data = await lastValueFrom(this.kubeVirtService.removeVmFromPool(vmNamespace, vmName, vmNode));
            this.fullReload();
        } catch (e: any) {
            this.myToasts.toastError(this.pageName, "", e.message);
            console.log(e);
        }
    }

    /*
     * Pool Basic Operations (start, stop, etc...)
     */
    async poolOperations(poolOperation: string, poolNamespace: string, poolName: string): Promise<void> {
        if(poolOperation == "start"){
            var data = await lastValueFrom(this.kubeVirtService.startPool(poolNamespace, poolName));
            this.myToasts.toastSuccess(this.pageName, "", "Started Pool: " + poolName);
            this.fullReload();
        } else if (poolOperation == "stop") {
            var data = await lastValueFrom(this.kubeVirtService.stopPool(poolNamespace, poolName));
            this.myToasts.toastSuccess(this.pageName, "", "Stopped Pool: " + poolName);
            this.fullReload();
        } else if (poolOperation == "delete") {
            const data = await lastValueFrom(this.kubeVirtService.deletePool(poolNamespace, poolName));
            this.myToasts.toastSuccess(this.pageName, "", "Deleted Pool: " + poolName);
            this.fullReload();
        }
    }

    /*
     * Show Replicas Window
     */
    showReplicas(poolNamespace: string, poolName: string): void {
        let modalDiv = document.getElementById("modal-replicas");
        let modalTitle = document.getElementById("replicas-title");
        let modalBody = document.getElementById("replicas-value");
        if(modalTitle != null) {
            modalTitle.replaceChildren("Scale: "+ poolNamespace + " - " + poolName);
        }
        if(modalBody != null) {
            let replicasNamespace = document.getElementById("replicas-namespace");
            let replicasName = document.getElementById("replicas-pool");
            if(replicasName != null && replicasNamespace != null) {
                replicasName.setAttribute("value", poolName);
                replicasNamespace.setAttribute("value", poolNamespace);
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
     * Perform Resize of VM Pool
     */
    async applyReplicas(replicasSize: string): Promise<void> {
        let nameField = document.getElementById("replicas-pool");
        let namespaceField = document.getElementById("replicas-namespace");
        if(replicasSize != null && nameField != null && namespaceField != null) {
            let poolNamespace = namespaceField.getAttribute("value");
            let poolName = nameField.getAttribute("value");
            if(replicasSize != null && poolName != null && poolNamespace != null) {
                try {
                    const data = await lastValueFrom(this.kubeVirtService.scalePoolReplicas(poolNamespace, poolName, replicasSize));
                    this.hideComponent("modal-resize");
                    this.myToasts.toastSuccess(this.pageName, "", "Edited Virtual Machine Pool: " + poolName);
                    this.fullReload();
                } catch (e: any) {
                    this.myToasts.toastError(this.pageName, "", e.message);
                    console.log(e);
                }
            }
        }
    }

    /*
     * Show Delete Window
     */
    showDelete(poolNamespace: string, poolName: string): void {
        let modalDiv = document.getElementById("modal-delete");
        let modalTitle = document.getElementById("delete-title");
        let modalBody = document.getElementById("delete-value");
        if(modalTitle != null) {
            modalTitle.replaceChildren("Delete");
        }
        if(modalBody != null) {
            let poolNameInput = document.getElementById("delete-name");
            let poolNamespaceInput = document.getElementById("delete-namespace");
            if(poolNameInput != null && poolNamespaceInput != null) {
                poolNameInput.setAttribute("value", poolName);
                poolNamespaceInput.setAttribute("value", poolNamespace);
                modalBody.replaceChildren("Are you sure you want to delete " + poolName + " on namespace: " + poolNamespace + "?");
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
    async applyDelete(): Promise<void> {
        let poolNameInput = document.getElementById("delete-name");
        let poolNamespaceInput = document.getElementById("delete-namespace");
        if(poolNameInput != null && poolNamespaceInput != null) {
            let poolName = poolNameInput.getAttribute("value");
            let poolNamespace = poolNamespaceInput.getAttribute("value");
            if(poolName != null && poolNamespace != null) {
                try {
                    const data = await lastValueFrom(this.kubeVirtService.deletePool(poolNamespace, poolName));
                    this.hideComponent("modal-delete");
                    this.myToasts.toastSuccess(this.pageName, "", "Deleted Virtual Machine Pool: " + poolName);
                    this.fullReload();
                } catch (e: any) {
                    this.myToasts.toastError(this.pageName, "", e.message);
                    console.log(e);
                }
            }
        }
    }

    /*
     * Show Delete VM Window
     */
    showDeleteVM(vmName: string, vmNamespace: string): void {
        let modalDiv = document.getElementById("modal-deletevm");
        let modalTitle = document.getElementById("deletevm-title");
        let modalBody = document.getElementById("deletevm-value");
        if(modalTitle != null) {
            modalTitle.replaceChildren("Delete");
        }
        if(modalBody != null) {
            let vmNameInput = document.getElementById("deletevm-name");
            let vmNamespaceInput = document.getElementById("deletevm-namespace");
            if(vmNameInput != null && vmNamespaceInput != null) {
                vmNameInput.setAttribute("value", vmName);
                vmNamespaceInput.setAttribute("value", vmNamespace);
                modalBody.replaceChildren("Are you sure you want to delete " + vmName + " on namespace: " + vmNamespace + "?");
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
     * Delete Virtual Machine
     */
    async applyDeleteVM(): Promise<void> {
        let vmNameInput = document.getElementById("deletevm-name");
        let vmNamespaceInput = document.getElementById("deletevm-namespace");
        if(vmNameInput != null && vmNamespaceInput != null) {
            let vmName = vmNameInput.getAttribute("value");
            let vmNamespace = vmNamespaceInput.getAttribute("value");
            if(vmName != null && vmNamespace != null) {
                try {
                    const data = await lastValueFrom(this.kubeVirtService.deleteVm(vmNamespace, vmName));
                    this.hideComponent("modal-deletevm");
                    this.myToasts.toastSuccess(this.pageName, "", "Deleted Virtual Machine: " + vmName);
                    this.fullReload();
                } catch (e: any) {
                    this.myToasts.toastError(this.pageName, "", e.message);
                    console.log(e);
                }
            }
        }
    }

    /*
     * Show Resize Pool Window
     */
    showResize(poolName: string, poolNamespace: string, poolSockets: number, poolCores: number, poolThreads: number, poolMemory: string): void {
        let modalDiv = document.getElementById("modal-resize");
        let modalTitle = document.getElementById("resize-title");
        let modalBody = document.getElementById("resize-value");
        if(modalTitle != null) {
            modalTitle.replaceChildren("Resize: " + poolName);
        }
        if(modalBody != null) {
            let resizeNameField = document.getElementById("resize-name");
            let resizeNamespaceField = document.getElementById("resize-namespace");
            let resizeSocketsField = document.getElementById("resize-sockets");
            let resizeCoresField = document.getElementById("resize-cores");
            let resizeThreadsField = document.getElementById("resize-threads");
            let resizeMemoryField = document.getElementById("resize-memory");
            if(resizeNameField != null && resizeNamespaceField != null && resizeSocketsField != null && resizeCoresField != null && resizeThreadsField != null && resizeMemoryField != null) {
                resizeNameField.setAttribute("value", poolName);
                resizeNamespaceField.setAttribute("value", poolNamespace);
                resizeSocketsField.setAttribute("placeholder", poolSockets.toString());
                resizeCoresField.setAttribute("placeholder", poolCores.toString());
                resizeThreadsField.setAttribute("placeholder", poolThreads.toString());
                resizeMemoryField.setAttribute("placeholder", poolMemory.toString());
                resizeSocketsField.setAttribute("value", poolSockets.toString());
                resizeCoresField.setAttribute("value", poolCores.toString());
                resizeThreadsField.setAttribute("value", poolThreads.toString());
                resizeMemoryField.setAttribute("value", poolMemory.replace("Gi", "").toString());
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
     * Resize Virtual Machine Pool
     */
    async applyResize(sockets: string, cores: string, threads: string, memory: string): Promise<void> {
        let resizeNameField = document.getElementById("resize-name");
        let resizeNamespaceField = document.getElementById("resize-namespace");
        if(sockets != "" && cores != "" && threads != "" && memory != "" && resizeNameField != null && resizeNamespaceField != null) {
            let resizeName = resizeNameField.getAttribute("value");
            let resizeNamespace = resizeNamespaceField.getAttribute("value");
            if(resizeName != null && resizeNamespace != null) {
                try {
                    const data = await lastValueFrom(this.kubeVirtService.scalePool(resizeNamespace, resizeName, cores, threads, sockets, memory));
                    this.hideComponent("modal-resize");
                    this.myToasts.toastSuccess(this.pageName, "", "Edited Virtual Machine Pool: " + resizeName);
                    this.fullReload();
                } catch (e: any) {
                    this.myToasts.toastError(this.pageName, "", e.message);
                    console.log(e);
                }
            }
        }
    }

    /*
     * Show Pool Type Window
     */
    async showType(poolName: string, poolNamespace: string): Promise<void> {
        let modalDiv = document.getElementById("modal-type");
        let modalTitle = document.getElementById("type-title");
        let modalBody = document.getElementById("type-value");
        if(modalTitle != null) {
            modalTitle.replaceChildren("Change Pool Type");
        }
        if(modalBody != null) {
            let poolNameInput = document.getElementById("type-pool");
            let poolNamespaceInput = document.getElementById("type-namespace");
            let selectorTypeFiled = document.getElementById("changepool-type");
            if(poolNameInput != null && poolNamespaceInput != null) {
                poolNameInput.setAttribute("value", poolName);
                poolNamespaceInput.setAttribute("value", poolNamespace);
                /* Load ClusterInstanceTyle List and Set Selector */
                let typeSelectorOptions = "";
                let data = await lastValueFrom(this.kubeVirtService.getClusterInstanceTypes());
                for (let i = 0; i < data.items.length; i++) {
                    typeSelectorOptions += "<option value=" + data.items[i].metadata["name"] +">" + data.items[i].metadata["name"] + "</option>\n";
                }
                if (selectorTypeFiled != null) {
                    selectorTypeFiled.innerHTML = typeSelectorOptions;
                }
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
     * Change Pool Type
     */
    async applyType(poolType: string): Promise<void> {
        let poolNameInput = document.getElementById("type-pool");
        let poolNamespaceInput = document.getElementById("type-namespace");
        if(poolNameInput != null && poolNamespaceInput != null) {
            let poolName = poolNameInput.getAttribute("value");
            let poolNamespace = poolNamespaceInput.getAttribute("value");
            if(poolName != null && poolNamespace != null) {
                try {
                    const data = await lastValueFrom(this.kubeVirtService.changePoolType(poolNamespace, poolName, poolType));
                    this.hideComponent("modal-type");
                    this.myToasts.toastSuccess(this.pageName, "", "Edited Virtual Machine Pool: " + poolName);
                    this.fullReload();
                } catch (e: any) {
                    this.myToasts.toastError(this.pageName, "", e.message);
                    console.log(e);
                }
            }
        }
    }

     /*
     * New VM: Control Disk Options
     */
     async onChangeDisk(diskNamespace: string, frmIndex: number) {
        let diskTypeField = document.getElementById("diskType-" + frmIndex.toString());
        let diskValueField = document.getElementById("diskValue-" + frmIndex.toString());
        let diskSizeField = document.getElementById("diskSize-" + frmIndex.toString());
        if(diskTypeField != null && diskTypeField instanceof HTMLSelectElement) {
            let diskType = diskTypeField.value;
            if (diskType == "blank") {
                if (diskValueField != null && diskSizeField != null) {
                    diskValueField.setAttribute("disabled", "disabled");
                    diskSizeField.removeAttribute("disabled");
                }
            } else if (diskType == "image") {
                if(diskValueField != null && diskSizeField != null) {
                    diskValueField.innerHTML = await this.loadImageOptions(diskNamespace);
                    diskValueField.removeAttribute("disabled");
                    diskSizeField.removeAttribute("disabled");
                }
            } else if (diskType == "dv") {
                if (diskValueField != null && diskSizeField != null) {
                    diskValueField.innerHTML = await this.loadDiskOptions(diskNamespace);
                    diskValueField.removeAttribute("disabled");
                    diskSizeField.setAttribute("disabled", "disabled");
                }
            }
        }
    }

    /*
     * New Pool: Load Image Options
     */
    async loadPVCOptions(dvNamespace: string){
        let pvcSelectorOptions = "";
        try {
            let data = await lastValueFrom(this.k8sService.getNamespacedPersistentVolumeClaims(dvNamespace));
            let pvcs = data.items;
            for (let i = 0; i < pvcs.length; i++) {
                pvcSelectorOptions += "<option value=" + pvcs[i].metadata["name"] +">" + pvcs[i].metadata["name"] + "</option>\n";
            }
        } catch (e: any) {
            console.log(e);
        }
        return pvcSelectorOptions;
    }

    /*
     * New Pool: Load Disk Options
     */
    async loadDiskOptions(dvNamespace: string) {
        let diskSelectorOptions = "";
        try {
            let data = await lastValueFrom(await this.dataVolumesService.getNamespacedDataVolumes(dvNamespace));
            let disks = data.items;
            for (let i = 0; i < disks.length; i++) {

                diskSelectorOptions += "<option value=" + disks[i].metadata["name"] +">" + disks[i].metadata["name"] + "</option>\n";
            }
        } catch (e: any) {
            console.log(e);
        }
        return diskSelectorOptions;
    }

    /*
     * New VM: Load Available Storage Classes
     */
    async diskLoadStorageClasses(frmIndex: number) {
        /* Load Storage Class List and Set Selector  */
        let storageSelectorOptions = "<option selected></option>\n";
        try {
            let data = await lastValueFrom(this.k8sApisService.getStorageClasses());
            for (let i = 0; i < data.items.length; i++) {
                storageSelectorOptions += "<option value=" + data.items[i].metadata["name"] +">" + data.items[i].metadata["name"] + "</option>\n";
            }
        } catch (e: any) {
            console.log(e);
        }

        let diskStorageClassField = document.getElementById("diskStorageClass-" + frmIndex.toString());

        if (diskStorageClassField != null) {
            diskStorageClassField.innerHTML = storageSelectorOptions;
        }
    }

    /*
     * New Pool: Load Network Options
     */
    async onChangeNamespace(namespace: string) {
        let selectorAuthType = document.getElementById("newpool-userdata-auth");
        let selectorSSHKey = document.getElementById("newpool-userdata-ssh");

        /* Reset SSH Key Options */
        if(selectorAuthType != null && selectorSSHKey != null) {
            let authOptions = "<option value=password>User/Password</option>\n<option value=ssh>SSH Private Key</option>";
            selectorAuthType.innerHTML = "";
            selectorSSHKey.innerHTML = "";
            selectorAuthType.innerHTML = authOptions;
            this.onChangeAuthType("password", namespace);
        }
    }

    /*
     * New Pool: Display Custom CPU/MEM
     */
    async onChangeType(vmType: string) {
        let modalDiv = document.getElementById("custom-cpu-memory");
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
     * New POOL: Change between pass/ssh auth
     */
    async onChangeAuthType(authType: string, namespace: string) {
        let modalSSHDiv = document.getElementById("newpool-userdata-ssh-panel");
        let modelPWDDiv = document.getElementById("newpool-userdata-password-panel");
        if(authType.toLowerCase() == "ssh") {
            let sshKeySelector = document.getElementById("newpool-userdata-ssh");
            if (sshKeySelector != null) {
                let data = await lastValueFrom(await this.k8sService.getSSHSecretsNamespaced(namespace));
                let keyList = data.items;
                let sshSelectorOptions = "";
                for(let i = 0; i < keyList.length; i++) {
                    sshSelectorOptions += "<option value=" + keyList[i].metadata["name"] + ">" + keyList[i].metadata["name"] + "</option>\n";
                }
                sshKeySelector.innerHTML = sshSelectorOptions;

            }
            if(modalSSHDiv != null && modelPWDDiv != null) {
                modalSSHDiv.setAttribute("class", "modal fade show");
                modalSSHDiv.setAttribute("aria-modal", "true");
                modalSSHDiv.setAttribute("role", "dialog");
                modalSSHDiv.setAttribute("aria-hidden", "false");
                modalSSHDiv.setAttribute("style","display: contents;");
                modelPWDDiv.setAttribute("class", "modal fade");
                modelPWDDiv.setAttribute("aria-modal", "false");
                modelPWDDiv.setAttribute("role", "");
                modelPWDDiv.setAttribute("aria-hidden", "true");
                modelPWDDiv.setAttribute("style","display: none;");
            }
        } else {
            if(modalSSHDiv != null && modelPWDDiv != null) {
                modelPWDDiv.setAttribute("class", "modal fade show");
                modelPWDDiv.setAttribute("aria-modal", "true");
                modelPWDDiv.setAttribute("role", "dialog");
                modelPWDDiv.setAttribute("aria-hidden", "false");
                modelPWDDiv.setAttribute("style","display: contents;");
                modalSSHDiv.setAttribute("class", "modal fade");
                modalSSHDiv.setAttribute("aria-modal", "false");
                modalSSHDiv.setAttribute("role", "");
                modalSSHDiv.setAttribute("aria-hidden", "true");
                modalSSHDiv.setAttribute("style","display: none;");
            }
        }
    }

    /*
     * New POOL: Networking Options
     */
    async onChangeNetwork(frmIndex: number) {
        let thisNetworkNameField = document.getElementById("networkName-" + frmIndex.toString());
        if (thisNetworkNameField != null && thisNetworkNameField instanceof HTMLSelectElement) {
            let thisNetwork = thisNetworkNameField.value;
            let selectorNetworkTypeField = document.getElementById("networkType-" + frmIndex.toString());
            let networkTypeSelectorOptions = "<option selected></option>\n<option value=bridge>bridge</option>\n";
            if(frmIndex == 0) {
                if(thisNetwork.toLowerCase() != "podnetwork") {
                    networkTypeSelectorOptions += "<option value=macvtap>macvtap</option>\n";

                } else {
                    networkTypeSelectorOptions += "<option value=masquerade>masquerade</option>\n";
                }

                if(selectorNetworkTypeField != null) {
                    selectorNetworkTypeField.innerHTML = networkTypeSelectorOptions;
                }
            } else {
                if(thisNetwork.toLowerCase() == "podnetwork") {
                    networkTypeSelectorOptions += "<option value=masquerade>masquerade</option>\n";
                } else {
                    networkTypeSelectorOptions += "<option value=macvtap>macvtap</option>\n";
                }

                if(selectorNetworkTypeField != null) {
                    selectorNetworkTypeField.innerHTML = networkTypeSelectorOptions;
                }
            }
        }
    }

    /*
     * New VM: Load Network Options
     */
    async loadNetworkOptions(frmIndex: number) {
        let namespaceField = document.getElementById("newpool-namespace");
        let netData = document.getElementById("newpool-netdata-tab");
        let networkSelectorOptions = "<option selected></option>\n<option value=podNetwork>podNetwork</option>\n";

        /* Set Networking options */
        if(this.networkCheck) {
            if(namespaceField != null && namespaceField instanceof HTMLSelectElement) {
                let namespace = namespaceField.value;
                let data = await lastValueFrom(this.k8sApisService.getNetworkAttachs());
                let netAttach = data.items;
                for (let i = 0; i < netAttach.length; i++) {
                    if(namespace == netAttach[i].metadata["namespace"]) {
                        let currentAttach = new NetworkAttach();
                        currentAttach.name = netAttach[i].metadata["name"];
                        currentAttach.namespace = netAttach[i].metadata["namespace"];
                        currentAttach.config = JSON.parse(netAttach[i].spec["config"]);
                        this.netAttachList.push(currentAttach);
                        networkSelectorOptions += "<option value=" + netAttach[i].metadata["namespace"] + "/" + netAttach[i].metadata["name"] + ">" + netAttach[i].metadata["name"] + "</option>\n";
                    }
                }
            }
        }

        let selectorNetworkField = document.getElementById("networkName-" + frmIndex.toString());
        if (selectorNetworkField != null && networkSelectorOptions != "") {
            selectorNetworkField.innerHTML = networkSelectorOptions;
        }
        if (netData != null && frmIndex == 0) {
            netData.setAttribute("style","display: none;");
        }
    }

    /*
     * Check Pool Exists
     */
    checkPoolExists(poolName: string, poolNamespace:string): boolean {
        for (let i = 0; i < this.poolList.length; i++) {
            if(this.poolList[i].name == poolName && this.poolList[i].namespace == poolNamespace) {
                return true;
            }
        }
        return false;
    }

    /*
     * New POOL: Enable/Disable Liveness Probe
     */
    async onChangeLiveness(status: string) {
        let hcType = document.getElementById("newpool-liveness-type");
        let hcPort = document.getElementById("newpool-liveness-port");
        let hcDelay = document.getElementById("newpool-liveness-initialdelay");
        let hcInterval = document.getElementById("newpool-liveness-interval");
        let hcTimeout = document.getElementById("newpool-liveness-timeout");
        let hcFailure = document.getElementById("newpool-liveness-failure");
        let hcSuccess = document.getElementById("newpool-liveness-success");
        
        if ( hcType != null && hcPort != null && hcDelay != null && hcInterval != null && 
             hcTimeout != null && hcFailure != null && hcSuccess != null ) {
            if(status.toLowerCase() == "enabled") {
                hcType.removeAttribute("disabled");
                hcPort.removeAttribute("disabled");
                hcDelay.removeAttribute("disabled");
                hcInterval.removeAttribute("disabled");
                hcTimeout.removeAttribute("disabled");
                hcFailure.removeAttribute("disabled");
                hcSuccess.removeAttribute("disabled");
            } else {
                hcType.setAttribute("disabled", "disabled");
                hcPort.setAttribute("disabled", "disabled");
                hcDelay.setAttribute("disabled", "disabled");
                hcInterval.setAttribute("disabled", "disabled");
                hcTimeout.setAttribute("disabled", "disabled");
                hcFailure.setAttribute("disabled", "disabled");
                hcSuccess.setAttribute("disabled", "disabled");
            }
        }
    }

    /*
     * New POOL: Change Liveness Type
     */
    async onChangeLivenessType(hcType: string) {
        let modalPath = document.getElementById("newpool-liveness-path-panel");
        if (modalPath != null) {
            if (hcType.toLowerCase() == "http") {
                modalPath.setAttribute("class", "modal fade show");
                modalPath.setAttribute("aria-modal", "true");
                modalPath.setAttribute("role", "dialog");
                modalPath.setAttribute("aria-hidden", "false");
                modalPath.setAttribute("style","display: contents;");
            } else {
                modalPath.setAttribute("class", "modal fade");
                modalPath.setAttribute("aria-modal", "false");
                modalPath.setAttribute("role", "");
                modalPath.setAttribute("aria-hidden", "true");
                modalPath.setAttribute("style","display: none;");
            }
        }
    }

    /*
     * New POOL: Enable/Disable Readiness Probe
     */
    async onChangeReadiness(status: string) {
        let hcType = document.getElementById("newpool-readiness-type");
        let hcPort = document.getElementById("newpool-readiness-port");
        let hcDelay = document.getElementById("newpool-readiness-initialdelay");
        let hcInterval = document.getElementById("newpool-readiness-interval");
        let hcTimeout = document.getElementById("newpool-readiness-timeout");
        let hcFailure = document.getElementById("newpool-readiness-failure");
        let hcSuccess = document.getElementById("newpool-readiness-success");
        
        if ( hcType != null && hcPort != null && hcDelay != null && hcInterval != null && 
             hcTimeout != null && hcFailure != null && hcSuccess != null ) {
            if(status.toLowerCase() == "enabled") {
                hcType.removeAttribute("disabled");
                hcPort.removeAttribute("disabled");
                hcDelay.removeAttribute("disabled");
                hcInterval.removeAttribute("disabled");
                hcTimeout.removeAttribute("disabled");
                hcFailure.removeAttribute("disabled");
                hcSuccess.removeAttribute("disabled");
            } else {
                hcType.setAttribute("disabled", "disabled");
                hcPort.setAttribute("disabled", "disabled");
                hcDelay.setAttribute("disabled", "disabled");
                hcInterval.setAttribute("disabled", "disabled");
                hcTimeout.setAttribute("disabled", "disabled");
                hcFailure.setAttribute("disabled", "disabled");
                hcSuccess.setAttribute("disabled", "disabled");
            }
        }
    }

    /*
     * New POOL: Change Readiness Probe Type
     */
    async onChangeReadinessType(hcType: string) {
        let modalPath = document.getElementById("newpool-readiness-path-panel");
        if (modalPath != null) {
            if (hcType.toLowerCase() == "http") {
                modalPath.setAttribute("class", "modal fade show");
                modalPath.setAttribute("aria-modal", "true");
                modalPath.setAttribute("role", "dialog");
                modalPath.setAttribute("aria-hidden", "false");
                modalPath.setAttribute("style","display: contents;");
            } else {
                modalPath.setAttribute("class", "modal fade");
                modalPath.setAttribute("aria-modal", "false");
                modalPath.setAttribute("role", "");
                modalPath.setAttribute("aria-hidden", "true");
                modalPath.setAttribute("style","display: none;");
            }
        }
    }

    /*
     * New Pool: Load Image Options
     */
    async loadImageOptions(imgNamespace: string) {
        let imgSelectorOptions = "<option selected></option>\n";
        try {
            let data = await lastValueFrom(await this.kubevirtMgrService.getNamespacedImages(imgNamespace));
            let images = data.items;
            for (let i = 0; i < images.length; i++) {

                imgSelectorOptions += "<option value=" + images[i].metadata["name"] +">" + images[i].metadata["name"] + "</option>\n";
            }
        } catch (e: any) {
            console.log(e);
        }
        return imgSelectorOptions;
    }

    /*
     * Load CRDs
     */
     async loadCrds(): Promise<void> {
        try {
            const data = await lastValueFrom(this.k8sApisService.getCrds());
            this.crdList = data.items;
        } catch (e: any) {
            this.crdList = [];
        }
    }

    /*
     * Check Multus Support
     */
    async checkNetwork(): Promise<void> {
        for (let i = 0; i <  this.crdList.length; i++) {
            if(this.crdList[i].metadata["name"] == this.myConstants.NetworkAttachmentDefinition) {
                this.networkCheck = true;
            }
        }
    }

    /*
     * Check CDI Support
     */
    async checkCDI(): Promise<void> {
        for (let i = 0; i < this.crdList.length; i++) {
            if(this.crdList[i].metadata["name"] == this.myConstants.ContainerizedDataImporter) {
                this.cdiCheck = true;
            }
        }

        if(this.cdiCheck == false) {
            this.myToasts.toastError(this.pageName, "", "CDI (Containerized Data Importer) not found! This component is required for disk and volume operations. Please visit KubeVirt website for installation instructions.");
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
     * full reload
     */
    fullReload(): void {
        this.router.navigateByUrl('/refresh',{skipLocationChange:true}).then(()=>{
            this.router.navigate([`/vmpools`]);
        })
    }
    

}
