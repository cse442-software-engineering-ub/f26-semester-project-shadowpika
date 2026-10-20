import{N as e,O as t,j as n,k as r}from"./api-DxUvtX0m.js";
import{t as i}from"./RequireLogin-ZBYk5Wwm.js";
import{t as a}from"./NavBar-Q0pxYCx3.js";
import"./session-guard-C3XdPHac.js";
import{f as o,i as s,l as c,u as l}from"./meetingRequests-C92vOjmG.js";

var u=e(r(),1),d=e(n(),1),f=t(),p=`./product-search.html`;

function m(){
    return(0,f.jsxs)(`a`,{
        className:`id-back`,
        href:p,
        onClick:e=>{
            document.referrer.includes(`product-search.html`)&&
            window.history.length>1&&
            (e.preventDefault(),window.history.back())
        },
        children:[
            (0,f.jsx)(`span`,{"aria-hidden":`true`,children:`←`}),
            ` Back to search`
        ]
    })
}

function h(){
    let[e,t]=(0,d.useState)(null),
        [n,r]=(0,d.useState)(`loading`),
        [i,u]=(0,d.useState)(``),
        [p,h]=(0,d.useState)(!1);

    return(0,d.useEffect)(()=>{
        let e=new URLSearchParams(window.location.search).get(`listing_id`)??``,
            n=!1;

        s(e).then(e=>{
            n||h(e.success===!0&&e.is_owner===!1)
        }).catch(()=>{});

        c(e).then(e=>{
            n||(e.success&&e.listing
                ?(t(e.listing),r(`done`),document.title=`Karavan - ${e.listing.name}`)
                :(u(e.error||`This item could not be loaded.`),r(`error`)))
        }).catch(()=>{
            n||(u(`Could not connect to the server.`),r(`error`))
        });

        return()=>{n=!0}
    },[]),

    (0,f.jsxs)(`div`,{
        className:`ps-page`,
        children:[
            (0,f.jsx)(a,{}),

            (0,f.jsxs)(`main`,{
                className:`ps-frame id-frame`,
                children:[
                    (0,f.jsx)(m,{}),

                    n===`loading`&&(0,f.jsx)(`p`,{
                        className:`id-message`,
                        children:`Loading item details...`
                    }),

                    n===`error`&&(0,f.jsx)(`p`,{
                        className:`id-message id-error`,
                        role:`alert`,
                        children:i
                    }),

                    n===`done`&&e&&(0,f.jsxs)(`article`,{
                        className:`id-item`,
                        children:[
                            (0,f.jsx)(`div`,{
                                className:`id-cover`,
                                children:(0,f.jsx)(o,{
                                    name:e.name,
                                    imageUrl:e.image_url
                                })
                            }),

                            (0,f.jsxs)(`div`,{
                                className:`id-info`,
                                children:[
                                    e.category&&(0,f.jsx)(`span`,{
                                        className:`id-category`,
                                        children:e.category.toUpperCase()
                                    }),

                                    (0,f.jsx)(`h1`,{
                                        className:`id-name`,
                                        children:e.name
                                    }),

                                    (0,f.jsxs)(`p`,{
                                        className:`id-price`,
                                        children:[`$`,e.price]
                                    }),

                                    p&&(0,f.jsxs)(`div`,{
                                        className:`id-actions`,
                                        children:[
                                            (0,f.jsx)(`button`,{
                                                type:`button`,
                                                className:`id-buy`,
                                                onClick:()=>{
                                                    window.location.assign(l(e.listing_id))
                                                },
                                                children:`Buy Now`
                                            }),

                                            (0,f.jsx)(`button`,{
                                                type:`button`,
                                                className:`id-message-seller`,
                                                onClick:()=>{
                                                    if(!e.owner_id){
                                                        alert(`Seller information is unavailable.`);
                                                        return;
                                                    }

                                                    const params=new URLSearchParams({
                                                        with:String(e.owner_id),
                                                        listing_id:String(e.listing_id)
                                                    });

                                                    window.location.assign(
                                                        `message.html?${params.toString()}`
                                                    );
                                                },
                                                children:`Message Seller`
                                            })
                                        ]
                                    }),

                                    (0,f.jsx)(`dl`,{
                                        className:`id-facts`,
                                        children:(0,f.jsxs)(`div`,{
                                            children:[
                                                (0,f.jsx)(`dt`,{
                                                    children:`Condition`
                                                }),
                                                (0,f.jsx)(`dd`,{
                                                    children:(0,f.jsx)(`span`,{
                                                        className:`id-condition`,
                                                        children:e.condition
                                                    })
                                                })
                                            ]
                                        })
                                    }),

                                    (0,f.jsxs)(`section`,{
                                        className:`id-description`,
                                        children:[
                                            (0,f.jsx)(`h2`,{
                                                children:`Description`
                                            }),
                                            e.description
                                                ?(0,f.jsx)(`p`,{
                                                    children:e.description
                                                })
                                                :(0,f.jsx)(`p`,{
                                                    className:`id-muted`,
                                                    children:`The seller didn't add a description.`
                                                })
                                        ]
                                    })
                                ]
                            })
                        ]
                    })
                ]
            })
        ]
    })
}

(0,u.createRoot)(document.getElementById(`root`)).render(
    (0,f.jsx)(d.StrictMode,{
        children:(0,f.jsx)(i,{
            children:(0,f.jsx)(h,{})
        })
    })
);