export interface MultiNetworkPolicy {
    apiVersion: k8s.cni.cncf.io/v1beta1
    kind: MultiNetworkPolicy
    metadata: {
        name: string;
        namespace: string;
        annotations?: {
            k8s.v1.cni.cncf.io/policy-for: string;
        };
        labels?: {};
    };
    spec: {
        policyTypes: {};    // INGRESS OR EGRESS (we dont support both / AND)
        podSelector: {
            matchLables?: {}; // key: value
        }
        ingress?: {
            from: {
                ipblock?: {
                    cidr: string;  // XXX.XXX.XXX.XXX/XX
                },
                namespaceSelector?: {
                    matchLabels?: {};  // key: value
                },
                podSelector?: {
                    matchLabels?: {}; // key: value
                }
            },
            ports: {
                port: number;
                protocol?: string;  // TCP / UDP
            }[];
        }[],
        egress?: {
            to: {
                ipblock?: {
                    cidr: string;  // XXX.XXX.XXX.XXX/XX
                },
                namespaceSelector?: {
                    matchLabels?: {};  // key: value
                },
                podSelector?: {
                    matchLabels?: {}; // key: value
                }
            },
            ports: {
                port: number;
                protocol?: string;  // TCP / UDP
            }[];
         }[];
    };
}