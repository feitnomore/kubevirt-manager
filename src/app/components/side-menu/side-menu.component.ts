import { Component, OnInit } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { K8sApisService } from 'src/app/services/k8s-apis.service';
import { Constants } from 'src/app/classes/constants';

@Component({
  selector: 'app-side-menu',
  templateUrl: './side-menu.component.html',
  styleUrls: ['./side-menu.component.css'],
})
export class SideMenuComponent implements OnInit {

    crdList: any;
    networkCheck: boolean = false;
    capkCheck: boolean = false;
    imgCheck: boolean = false;
    cdiCheck: boolean = false;
    myConstants!: Constants;

    constructor(
        private k8sApisService: K8sApisService
    ) { }

    async ngOnInit(): Promise<void> {
        this.myConstants = new Constants();
        await this.loadCrds();
        this.checkNetwork();
        this.checkCapk();
        this.checkImage();
        this.checkCDI();
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
     * Check Capk Support (few of the CRDs we use)
     */
    async checkCapk(): Promise<void> {
        let cluster: boolean = false;
        let kubeadm: boolean = false;
        let kubeadmcontrolplane: boolean = false;
        let machinedeployments: boolean = false;
        let kubevirtclusters: boolean = false;
        let kubevirtmachinetemplates: boolean = false;
        for (let i = 0; i < this.crdList.length; i++) {
            if(this.crdList[i].metadata["name"] == this.myConstants.Clusters) {
                cluster = true;
            } else if(this.crdList[i].metadata["name"] == this.myConstants.KubeadmConfigs) {
                kubeadm = true;
            } else if(this.crdList[i].metadata["name"] == this.myConstants.KubeadmControlPlanes) {
                kubeadmcontrolplane = true;
            } else if(this.crdList[i].metadata["name"] ==this.myConstants.MachineDeployments) {
                machinedeployments = true;
            } else if(this.crdList[i].metadata["name"] == this.myConstants.KubevirtClusters) {
                kubevirtclusters = true;
            } else if(this.crdList[i].metadata["name"] == this.myConstants.KubevirtMachineTemplates) {
                kubevirtmachinetemplates = true;
            }
        }

        if(cluster && kubeadm && kubeadmcontrolplane && machinedeployments && kubevirtclusters && kubevirtmachinetemplates) {
            this.capkCheck = true;
        }
    }

    /*
     * Check Multus Support
     */
    async checkNetwork(): Promise<void> {
        for (let i = 0; i < this.crdList.length; i++) {
            if(this.crdList[i].metadata["name"] == this.myConstants.NetworkAttachmentDefinition) {
                this.networkCheck = true;
            }
        }
    }

    /*
     * Check Images Support
     */
    async checkImage(): Promise<void> {
        for (let i = 0; i < this.crdList.length; i++) {
            if(this.crdList[i].metadata["name"] == this.myConstants.KubevirtManagerImages) {
                this.imgCheck = true;
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
    }
}
