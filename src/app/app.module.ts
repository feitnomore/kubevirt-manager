import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MainHeaderComponent } from './components/main-header/main-header.component';
import { SideMenuComponent } from './components/side-menu/side-menu.component';
import { MainFooterComponent } from './components/main-footer/main-footer.component';
import { NodelistComponent } from './components/nodelist/nodelist.component';
import { VmlistComponent } from './components/vmlist/vmlist.component';
import { DiskListComponent } from './components/disk-list/disk-list.component';
import { NetworkListComponent } from './components/network-list/network-list.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { ClusterInstanceTypeListComponent } from './components/cluster-instance-type-list/cluster-instance-type-list.component';
import { VMPoolsComponent } from './components/vmpools/vmpools.component';
import { LoadBalancersComponent } from './components/load-balancers/load-balancers.component';
import { RefreshComponent } from './components/refresh/refresh.component';
import { AutoscaleComponent } from './components/autoscale/autoscale.component';
import { VmpooldetailsComponent } from './components/vmpooldetails/vmpooldetails.component';
import { VmdetailsComponent } from './components/vmdetails/vmdetails.component';
import { KClusterComponent } from './components/kcluster/kcluster.component';
import { KClusterDetailsComponent } from './components/kcluster-details/kcluster-details.component';
import { KClusterPoolDetailsComponent } from './components/kcluster-pool-details/kcluster-pool-details.component';
import { ImagesComponent } from './components/images/images.component';
import { SSHKeysComponent } from './components/sshkeys/sshkeys.component';
import { FirewallListComponent } from './components/firewall-list/firewall-list.component';
import { SettingsComponent } from './components/settings/settings.component';
import { DataTablesModule } from 'angular-datatables'

@NgModule({ declarations: [
        AppComponent,
        MainHeaderComponent,
        SideMenuComponent,
        MainFooterComponent,
        NodelistComponent,
        VmlistComponent,
        DiskListComponent,
        NetworkListComponent,
        DashboardComponent,
        ClusterInstanceTypeListComponent,
        VMPoolsComponent,
        LoadBalancersComponent,
        RefreshComponent,
        AutoscaleComponent,
        VmpooldetailsComponent,
        VmdetailsComponent,
        KClusterComponent,
        KClusterDetailsComponent,
        KClusterPoolDetailsComponent,
        ImagesComponent,
        SSHKeysComponent,
        FirewallListComponent,
        SettingsComponent
    ],
    bootstrap: [
        AppComponent
    ],
    imports: [
        BrowserModule,
        AppRoutingModule,
        FormsModule,
        ReactiveFormsModule,
        DataTablesModule,
    ],
    providers: [
        provideHttpClient(withInterceptorsFromDi())
    ]
})
export class AppModule { }
