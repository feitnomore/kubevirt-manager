import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, lastValueFrom } from 'rxjs';
import { Secret } from 'src/app/interfaces/secret';
import { SSHKey } from 'src/app/models/sshkey.model';
import { K8sService } from 'src/app/services/k8s.service';
import { Config } from 'datatables.net';
import { Constants } from 'src/app/classes/constants';
import { Toasts } from 'src/app/classes/toasts';

@Component({
  selector: 'app-sshkeys',
  templateUrl: './sshkeys.component.html',
  styleUrls: ['./sshkeys.component.css']
})
export class SSHKeysComponent implements OnInit {

    pageName: string = "SSH Keys";

    myConstants!: Constants;
    myToasts!: Toasts;
    keyList: SSHKey [] = [];
    namespacesList: string[] = [];

    /*
     * Dynamic Tables
     */
    sshList_dtOptions: Config = {
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
        columnDefs: [{ orderable: false, targets: 0 }, { orderable: false, targets: 4 }],
        order: [[1, 'asc']],
    };
    sshList_dtTrigger: Subject<any> = new Subject<any>();

    constructor(
        private router: Router,
        private k8sService: K8sService
    ) { }

    async ngOnInit(): Promise<void> {
        let navTitle = document.getElementById("nav-title");
        if(navTitle != null) {
            navTitle.replaceChildren(this.pageName);
        }
        this.myConstants = new Constants();
        this.myToasts = new Toasts();
        await this.getKeys();
        this.sshList_dtTrigger.next(null);
        await this.getNamespaces();
    }

    ngOnDestroy() {
        this.sshList_dtTrigger.unsubscribe();
    }

    /*
     * Get the list of Keys
     */
    async getKeys(): Promise<void> {
        this.keyList = [];
        let currentKey = new SSHKey;
        const data = await lastValueFrom(this.k8sService.getSSHSecrets());
        let keys = data.items;
        for (let i = 0; i < keys.length; i++) {
            currentKey = new SSHKey();
            currentKey.name = keys[i].metadata["name"];
            currentKey.namespace = keys[i].metadata["namespace"];
            currentKey.creationTimestamp = new Date(keys[i].metadata["creationTimestamp"]);
            currentKey.type = keys[i].type;
            currentKey.key = keys[i].data["ssh-privatekey"];
            this.keyList.push(currentKey);
        }
    }

    /*
     * Get Namespaces from Kubernetes
     */
    async getNamespaces(): Promise<void> {
        try {
            const data = await lastValueFrom(this.k8sService.getNamespaces());
            let nss = data.items;
            for (let i = 0; i < nss.length; i++) {
            this.namespacesList.push(nss[i].metadata["name"]);
            }
        } catch (e: any) {
            console.log(e);
        }
    }

    /*
     * Show New Window
     */
    showNew(): void {
        let modalDiv = document.getElementById("modal-new");
        let modalTitle = document.getElementById("new-title");
        let selectorNamespacesField = document.getElementById("new-key-namespace");
        if(modalTitle != null) {
            modalTitle.replaceChildren("New SSH Key");
        }

         /* Load Namespace List and Set Selector */
         let nsSelectorOptions = "";
         for (let i = 0; i < this.namespacesList.length; i++) {
             nsSelectorOptions += "<option value=" + this.namespacesList[i] +">" + this.namespacesList[i] + "</option>\n";
         }
         if (selectorNamespacesField != null) {
             selectorNamespacesField.innerHTML = nsSelectorOptions;
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
     * Create the new image
     */
    async applyNew(name: string, namespace: string, value: string): Promise<void> {
        if(name != "" && namespace != "" && value != "") {
            let myKey: Secret = {
                apiVersion: 'v1',
                kind: 'Secret',
                metadata: {
                    name: name,
                    namespace: namespace,
                    labels: {
                        [this.myConstants.KubevirtManagerManaged]: "true",
                        [this.myConstants.KubevirtManagerSsh]: "true"
                    }
                },
                type: this.myConstants.KubernetesSecretSshAuth,
                data: {
                    'ssh-privatekey': btoa(value)
                }
            };
            try {
                const data = await lastValueFrom(this.k8sService.createSecret(myKey));
                this.hideComponent("modal-new");
                this.myToasts.toastSuccess(this.pageName, "", "Created SSH Key: " + name);
                this.fullReload(); 
            } catch (e: any) {
                this.myToasts.toastError(this.pageName, "", e.message);
                console.log(e);
            }
        } else {
            alert("Make sure to fill the required fields: name, namespace and value");
        }
    }

    /*
    * Show Delete Window
    */
    showDelete(name: string, namespace: string): void {
        let modalDiv = document.getElementById("modal-delete");
        let modalTitle = document.getElementById("delete-title");
        let modalBody = document.getElementById("delete-value");
        if(modalTitle != null) {
            modalTitle.replaceChildren("Delete");
        }
        if(modalBody != null) {
            let keyNameInput = document.getElementById("delete-name");
            let keyNamespaceInput = document.getElementById("delete-namespace");
            if(keyNameInput != null && keyNamespaceInput != null) {
                keyNameInput.setAttribute("value", name);
                keyNamespaceInput.setAttribute("value", namespace);
                modalBody.replaceChildren("Are you sure you want to delete " + namespace + " - " + name + "?");
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
     * Delete image
     */
    async applyDelete(): Promise<void> {
        let keyNameField = document.getElementById("delete-name");
        let keyNamespaceField = document.getElementById("delete-namespace");
        if(keyNameField != null && keyNamespaceField != null) {
            let keyNamespace = keyNamespaceField.getAttribute("value");
            let keyName = keyNameField.getAttribute("value");
            if(keyName != null && keyNamespace != null) {
                try {
                    let deleteSecret = await lastValueFrom(this.k8sService.deleteSecret(keyNamespace, keyName));
                    this.hideComponent("modal-delete");
                    this.myToasts.toastSuccess(this.pageName, "", "Deleted SSH Key: " + keyName);
                    this.fullReload();
                } catch (e: any) {
                    this.myToasts.toastError(this.pageName, "", e.message);
                    console.log(e);
                }
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
     * full reload
     */
    fullReload(): void {
        this.router.navigateByUrl('/refresh',{skipLocationChange:true}).then(()=>{
            this.router.navigate([`/sshkeys`]);
        })
    }

}
