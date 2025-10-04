import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, lastValueFrom } from 'rxjs';
import { LoadBalancerPort } from 'src/app/models/load-balancer-port.model';
import { LoadBalancer } from 'src/app/models/load-balancer.model';
import { K8sService } from 'src/app/services/k8s.service';
import { KubeVirtService } from 'src/app/services/kube-virt.service';
import { Services } from 'src/app/interfaces/services';
import { ServicesPort } from 'src/app/interfaces/services-port';
import { FormArray, FormBuilder, FormGroup } from '@angular/forms';
import { Config } from 'datatables.net';

@Component({
  selector: 'app-load-balancers',
  templateUrl: './load-balancers.component.html',
  styleUrls: ['./load-balancers.component.css']
})
export class LoadBalancersComponent implements OnInit {

    loadBalancerList: LoadBalancer[] = [];
    charDot = '.';

    /*
     * Dynamic Forms
     */
    portList: FormGroup;
    annotationList: FormGroup;
    labelList: FormGroup;

    /*
     * Dynamic Tables
     */
    lbList_dtOptions: Config = {
        paging: false,
        info: false,
        ordering: true,
        orderMulti: true,
        search: true,
        destroy: false,
        stateSave: false,
        serverSide: false,
        columnDefs: [{ orderable: false, targets: 0 }, { orderable: false, targets: 7 }],
        order: [[1, 'asc']],
    };
    lbList_dtTrigger: Subject<any> = new Subject<any>();

    constructor(
        private router: Router,
        private k8sService: K8sService,
        private kubeVirtService: KubeVirtService,
        private fb: FormBuilder
    ) { 
        this.portList = this.fb.group({
            ports: this.fb.array([]),
        });
        this.annotationList = this.fb.group({
            annotations: this.fb.array([]),
        });
        this.labelList = this.fb.group({
            labels: this.fb.array([]),
        });
    }

    async ngOnInit(): Promise<void> {
        let navTitle = document.getElementById("nav-title");
        if(navTitle != null) {
            navTitle.replaceChildren("Load Balancers");
        }
        this.portList = this.fb.group({
            ports: this.fb.array([this.createPortGroup()]),
        });
        this.annotationList = this.fb.group({
            annotations: this.fb.array([]),
        });
        this.labelList = this.fb.group({
            labels: this.fb.array([]),
        });
        await this.getLoadBalancers();
        this.lbList_dtTrigger.next(null);
    }

    ngOnDestroy() {
        this.lbList_dtTrigger.unsubscribe();
    }

    /* Getting the Ports FormArray */
    get ports(): FormArray {
        return this.portList.get('ports') as FormArray;
    }

    /* Port FormGroup */
    createPortGroup(): FormGroup {
        return this.fb.group({
            portName: [''],
            srcPort: [''],
            dstPort: [''],
            portProtocol: ['TCP'],
        });
    }

    /* Add a new Port entry to the Group */
    addPort(): void {
        if (this.ports.length < 8) {
            this.ports.push(this.createPortGroup());
        } else {
            alert('You can only add a maximum of 8 ports.');
        }
    }

    /* Remove Port entry from the Group */
    removePort(index: number): void {
        this.ports.removeAt(index);
    }

    /* Getting all the ports */
    getPorts(): any[] {
        return this.portList.value.ports;
    }

    /*
     * Port Form Validation
     */
    validatePorts(): boolean {
        let toValidate = this.getPorts();
        if (toValidate.length < 1) {
            return false;
        } else {
            for (let i = 0; i < toValidate.length; i ++) {
                if (toValidate[i].portName == "") {
                    alert("Port " + i + " has no Name set.")
                    return false;
                } else if (toValidate[i].srcPort == "") {
                    alert("Port " + i + " has no Source Port set.")
                    return false;
                } else if (toValidate[i].dstPort == "") {
                    alert("Port " + i + " has no Destination Port set.")
                    return false;
                }
            }
        }
        return true;
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
        });
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

    /*
     * Get Services from Kubernetes
     */
    async getLoadBalancers(): Promise<void> {
        this.loadBalancerList = [];
        let currentLoadBalancer = new LoadBalancer;
        try {
            const data = await lastValueFrom(this.k8sService.getServices());
            let services = data.items;
            for(let i = 0; i < services.length; i++) {
                currentLoadBalancer = new LoadBalancer();
                currentLoadBalancer.name = services[i].metadata.name;
                currentLoadBalancer.namespace = services[i].metadata.namespace;
                currentLoadBalancer.creationTimestamp = new Date(services[i].metadata.creationTimestamp);
                currentLoadBalancer.type = services[i].spec.type;
                currentLoadBalancer.clusterIP = services[i].spec.clusterIP;
                if(services[i].spec.selector["kubevirt.io/vmpool"] != null) {
                    currentLoadBalancer.targetResource = services[i].spec.selector["kubevirt.io/vmpool"];
                } else if (services[i].spec.selector["cluster.x-k8s.io/cluster-name"] != null) {
                    currentLoadBalancer.targetResource = services[i].spec.selector["cluster.x-k8s.io/cluster-name"];
                } else if(services[i].spec.selector["kubevirt.io/domain"] != null) {
                    currentLoadBalancer.targetResource = services[i].spec.selector["kubevirt.io/domain"];
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
                this.loadBalancerList.push(currentLoadBalancer);
            }
        } catch (e: any) {
            console.log(e);
        }
    }

    /*
     * Show Info Window
     */
    async showInfo(lbNamespace: string, lbName: string): Promise<void> {
        let myInnerHTML = "";
        try {
            let data = await lastValueFrom(this.k8sService.getService(lbNamespace, lbName));
            myInnerHTML += "<li class=\"nav-item\">Service: <span class=\"float-right badge bg-primary\">" + data.metadata["name"] + "</span></li>";
            myInnerHTML += "<li class=\"nav-item\">Namespace: <span class=\"float-right badge bg-primary\">" + data.metadata["namespace"] + "</span></li>";
            myInnerHTML += "<li class=\"nav-item\">Creation Time: <span class=\"float-right badge bg-primary\">" + data.metadata["creationTimestamp"] + "</span></li>";
            myInnerHTML += "<li class=\"nav-item\">Type: <span class=\"float-right badge bg-primary\">" + data.spec["type"] + "</span></li>";
            myInnerHTML += "<li class=\"nav-item\">ClusterIP: <span class=\"float-right badge bg-primary\">" + data.spec["clusterIP"] + "</span></li>";

            if(data.spec.selector["kubevirt.io/vmpool"] != null) {
                myInnerHTML += "<li class=\"nav-item\">Target VM Pool: <span class=\"float-right badge bg-primary\">" + data.spec.selector["kubevirt.io/vmpool"] + "</span></li>";
            } else if(data.spec.selector["kubevirt.io/domain"] != null) {
                myInnerHTML += "<li class=\"nav-item\">Target Instance: <span class=\"float-right badge bg-primary\">" + data.spec.selector["kubevirt.io/domain"] + "</span></li>";
            } else if(data.spec.selector["cluster.x-k8s.io/cluster-name"] != null) {
                myInnerHTML += "<li class=\"nav-item\">Target Cluster: <span class=\"float-right badge bg-primary\">" + data.spec.selector["cluster.x-k8s.io/cluster-name"] + "</span></li>";
            }

            if(data.spec["type"].toLowerCase() == "loadbalancer" && data.status.loadBalancer.ingress[0].ip != null) {
                myInnerHTML += "<li class=\"nav-item\">External IP: <span class=\"float-right badge bg-primary\">" + data.status.loadBalancer.ingress[0].ip + "</span></li>";
            } if(data.spec["type"].toLowerCase() == "nodeport" && data.spec.ports[0].nodePort != null) {
                myInnerHTML += "<li class=\"nav-item\">Node Port: <span class=\"float-right badge bg-primary\">" + data.spec.ports[0].nodePort + "</span></li>";
            }
            myInnerHTML += "<div class=\"row\">&nbsp;</div>";
            myInnerHTML += "<table class=\"table table-sm\" style=\"vertical-align: middle !important;\">";
            myInnerHTML += "    <thead>";
            myInnerHTML += "      <tr>";
            myInnerHTML += "        <th style=\"width: 100px\">Name</th>";
            myInnerHTML += "        <th style=\"width: 100px\">Protocol</th>";
            myInnerHTML += "        <th style=\"width: 80px\">Src</th>";
            myInnerHTML += "        <th style=\"width: 80px\">Dst</th>";
            myInnerHTML += "      </tr>";
            myInnerHTML += "    </thead>";
            myInnerHTML += "    <tbody>";
            for (let i = 0; i < data.spec.ports.length; i++) {
                let portName = data.spec.ports[i].name || "";
                myInnerHTML += "<tr>";
                myInnerHTML += "<td>" + portName + "</td><td>" + data.spec.ports[i].protocol + "</td><td>" + data.spec.ports[i].port + "</td><td>" + data.spec.ports[i].targetPort + "</td>";
                myInnerHTML += "</tr>";
            }
            myInnerHTML += "    </tbody>";
            myInnerHTML += "</table>";
        } catch (e: any) {
            console.log(e);
        }

        let modalDiv = document.getElementById("modal-info");
        let modalTitle = document.getElementById("info-title");
        let modalBody = document.getElementById("info-cards");
        if(modalTitle != null) {
            modalTitle.replaceChildren("Load Balancer: " + lbName);
        }
        if(modalBody != null) {
            modalBody.innerHTML = myInnerHTML;
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
     * Show Delete Window
     */
    showDelete(lbNamespace: string, lbName: string): void {
        let modalDiv = document.getElementById("modal-delete");
        let modalTitle = document.getElementById("delete-title");
        let modalBody = document.getElementById("delete-value");
        if(modalTitle != null) {
            modalTitle.replaceChildren("Delete");
        }
        if(modalBody != null) {
            let lbNamespaceInput = document.getElementById("delete-namespace");
            let lbNameInput = document.getElementById("delete-name");
            if(lbNameInput != null && lbNamespaceInput != null) {
                lbNamespaceInput.setAttribute("value", lbNamespace);
                lbNameInput.setAttribute("value", lbName);
                modalBody.replaceChildren("Are you sure you want to delete Load Balancer " + lbNamespace + " - " + lbName + "?");
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
     * Delete Kubernetes Service
     */
    async applyDelete(): Promise<void> {
        let nameField = document.getElementById("delete-name");
        let namespaceField = document.getElementById("delete-namespace");
        if(nameField != null && namespaceField != null) {
            let lbNamespace = namespaceField.getAttribute("value");
            let lbName = nameField.getAttribute("value");
            if(lbName != null && lbNamespace != null) {
                try {
                    let deleteService = await lastValueFrom(this.k8sService.deleteService(lbNamespace, lbName));
                    this.hideComponent("modal-delete");
                    this.fullReload();
                } catch (e: any) {
                    alert(e.error.message);
                    console.log(e);
                }
            }
        }
    }

    /*
     * Show Change Type Window
     */
    showType(lbNamespace: string, lbName: string): void {
        let modalDiv = document.getElementById("modal-type");
        let modalTitle = document.getElementById("type-title");
        let modalBody = document.getElementById("type-value");
        if(modalTitle != null) {
            modalTitle.replaceChildren("Config");
        }
        if(modalBody != null) {
            let lbNamespaceInput = document.getElementById("type-namespace");
            let lbNameInput = document.getElementById("type-name");
            if(lbNameInput != null && lbNamespaceInput != null) {
                lbNamespaceInput.setAttribute("value", lbNamespace);
                lbNameInput.setAttribute("value", lbName);
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
     * Change Service Type
     */
    async applyType(newType: string): Promise<void> {
        let nameField = document.getElementById("type-name");
        let namespaceField = document.getElementById("type-namespace");
        if(nameField != null && namespaceField != null) {
            let lbNamespace = namespaceField.getAttribute("value");
            let lbName = nameField.getAttribute("value");
            if(lbName != null && lbNamespace != null) {
                try {
                    let newTypeData = await lastValueFrom(this.k8sService.changeServiceType(lbNamespace, lbName, newType));
                    this.hideComponent("modal-type");
                    this.fullReload();
                } catch (e: any) {
                    alert(e.error.message);
                    console.log(e);
                }
            }
        }
    }

    /*
     * Show New Window
     */
    async showNew(): Promise<void> {
        let modalDiv = document.getElementById("modal-new");
        let modalTitle = document.getElementById("new-title");
        let modalBody = document.getElementById("new-value");
        let nsSelectorOptions = "<option>&nbsp</option>\n";

        let selectorNamespacesField = document.getElementById("newlb-namespace");

        /* Load Namespace List and Set Selector */
        try{
            let data = await lastValueFrom(this.k8sService.getNamespaces());
            for (let i = 0; i < data.items.length; i++) {
                nsSelectorOptions += "<option value=" + data.items[i].metadata["name"] +">" + data.items[i].metadata["name"] + "</option>\n";
            }
        } catch (e: any) {
            console.log(e);
        }

        if (selectorNamespacesField != null) {
            selectorNamespacesField.innerHTML = nsSelectorOptions;
        }

        if(modalTitle != null) {
            modalTitle.replaceChildren("New Load Balancer");
            
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
     * Create New Service
     */
    async applyNew(
        newlbname: string,
        newlbnamespace: string,
        newlbtargetresourcetype: string,
        newlbtargetresource: string,
        newlbtargettype: string
        ): Promise<void> {
        if(newlbname == "") {
            alert("You must select a name for your Load Balancer!");
        } else if(newlbname.includes(this.charDot)) {
            alert("Your Load Balancer name should not have .(dot)!");
        } else if (newlbtargetresourcetype == "" || newlbtargetresource == "" || newlbtargettype == "") {
            alert("Please select all the target properties!");
        } else if (this.validatePorts() && this.validateLabels() && this.validateAnnotations()){

            let portsForm = this.getPorts();
            let servicePorts: ServicesPort[] = [];
            for (let i = 0; i < portsForm.length; i++) {
                /* Port and Proto settings */
                let servicePort: ServicesPort = {
                    name: portsForm[i].portName,
                    port: Number(portsForm[i].srcPort),
                    targetPort: Number(portsForm[i].dstPort),
                    protocol: portsForm[i].portProtocol
                };
                servicePorts.push(servicePort);
            }

            /* Load Custom Labels */
            let labelsForm = this.getLabels();
            let tmpLabels = {};
            for (let i = 0; i < labelsForm.length; i++) {
                let thisLabel = {
                    [labelsForm[i].labelKey.toString()] : labelsForm[i].labelValue
                };
                Object.assign(tmpLabels, thisLabel);
            }

            /* Selector and Labels */            
            let thisSelector = {};
            if(newlbtargetresourcetype == "vmpool") {
                let vmPoolLabel = {
                    ["kubevirt.io/vmpool"]: newlbtargetresource
                };
                Object.assign(tmpLabels, vmPoolLabel);
                Object.assign(thisSelector, vmPoolLabel);
            } else if(newlbtargetresourcetype == "vminstance") {
                let vmInstanceLabel = {
                    ["kubevirt.io/domain"]: newlbtargetresource
                };
                Object.assign(tmpLabels, vmInstanceLabel);
                Object.assign(thisSelector, vmInstanceLabel);
            } else if(newlbtargetresourcetype == "capk") {
                let thisSelector = {};
                let vmClusterLabel = {
                    ["cluster.x-k8s.io/cluster-name"]: newlbtargetresource
                };
                Object.assign(tmpLabels, vmClusterLabel);
                Object.assign(thisSelector, vmClusterLabel);
            }

            let kubevirtManagerLabel = {
                ["kubevirt-manager.io/managed"]: "true"
            };
            Object.assign(tmpLabels, kubevirtManagerLabel);


            /* Load Annotations */
            let annotationsForm = this.getAnnotations();
            let tmpAnnotations = {};
            for (let i = 0; i < annotationsForm.length; i++) {
                let thisAnnotation = {
                    [annotationsForm[i].annotKey.toString()] : annotationsForm[i].annotValue
                };
                Object.assign(tmpAnnotations, thisAnnotation);
            }

            /* Build Service Payload */
            let myService: Services = {
                apiVersion: "v1",
                kind: "Service",
                metadata: {
                    name: newlbname,
                    namespace: newlbnamespace,
                    labels: tmpLabels,
                    annotations: tmpAnnotations
                },
                spec: {
                    type: newlbtargettype,
                    ports: servicePorts,
                    selector: thisSelector,
                }
            };

            try {
                let newLbData = await lastValueFrom(this.k8sService.createService(myService));
                this.hideComponent("modal-new");
                this.fullReload();
            } catch (e: any) {
                alert(e.error.message);
                console.log(e);
            }
        }
    }

    /*
     * New LB: Load Available Resources
     */
    async onChangeNamespaceOrResourceType(namespace: string, resourcetype: string) {
        let selectorPoolField = document.getElementById("newlb-targetresource");
        let resourceSelectorOptions = "";
        if (resourcetype == "vmpool") { /* Virtual Machine Pool */
            let data = await lastValueFrom(this.kubeVirtService.getVMPoolsNamespaced(namespace));
            let thisPoolList = data.items;
            for (let i = 0; i < thisPoolList.length; i++) {
                resourceSelectorOptions += "<option value=" + thisPoolList[i].metadata["name"] + ">" + thisPoolList[i].metadata["name"] + "</option>\n";
            }
        } else if (resourcetype == "vminstance") { /* Virtual Machine Instance */
            let data = await lastValueFrom(this.kubeVirtService.getVMsNamespaced(namespace));
            let thisVMList = data.items;
            for (let i = 0; i < thisVMList.length; i++) {
                resourceSelectorOptions += "<option value=" + thisVMList[i].metadata["name"] + ">" + thisVMList[i].metadata["name"] + "</option>\n";
            }
        } else if (resourcetype == "capk") {   /* Future Cluster API */
            let data = await lastValueFrom(this.kubeVirtService.getVMsNamespaced(namespace));
            let thisVMList = data.items;
            for (let i = 0; i < thisVMList.length; i++) {
                resourceSelectorOptions += "<option value=" + thisVMList[i].metadata["name"] + ">" + thisVMList[i].metadata["name"] + "</option>\n";
            }
        }
        if (selectorPoolField != null) {
            selectorPoolField.innerHTML = resourceSelectorOptions;
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
            this.router.navigate([`/lblist`]);
        })
    }

}
