import { Component, OnInit } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { NetworkAttach } from 'src/app/models/network-attach.model';
import { K8sApisService } from 'src/app/services/k8s-apis.service';

@Component({
  selector: 'app-network-list',
  templateUrl: './network-list.component.html',
  styleUrls: ['./network-list.component.css']
})
export class NetworkListComponent implements OnInit {

    pageName: string = "Networks";

    netAttachList: NetworkAttach[] = [];

    constructor(
        private k8sApisService: K8sApisService
    ) { }

    async ngOnInit(): Promise<void> {
        let navTitle = document.getElementById("nav-title");
        if(navTitle != null) {
            navTitle.replaceChildren(this.pageName);
        }
        await this.getNetworks();
    }

    /*
     * Get Network Attachments from Kubernetes
     */
    async getNetworks(): Promise<void> {
        try {
            let currentAttach = new NetworkAttach;
            const data = await lastValueFrom(this.k8sApisService.getNetworkAttachs());
            let netAttach = data.items;
            for (let i = 0; i < netAttach.length; i++) {
                currentAttach = new NetworkAttach();
                currentAttach.name = netAttach[i].metadata["name"];
                currentAttach.namespace = netAttach[i].metadata["namespace"];
                currentAttach.config = JSON.parse(netAttach[i].spec["config"]);
                this.netAttachList.push(currentAttach);
            }
        } catch (e: any) {
            console.log(e);
        }
    }

}
