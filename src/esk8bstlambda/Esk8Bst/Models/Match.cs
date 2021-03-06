﻿using Google.Cloud.Firestore;
using Newtonsoft.Json.Linq;
using System.Collections.Generic;

namespace Esk8Bst.Models {
    [FirestoreData]
    public class Match {
        [FirestoreProperty("companies")]
        public List<string> Companies { get; set; }

        [FirestoreProperty("currency")]
        public string Currency { get; set; } = CurrencyMap.USD.Code;

        [FirestoreProperty("price")]
        public int? Price { get; set; }

        private string _bst;
        [FirestoreProperty("bst")]
        public string bst {
            get { return _bst; }
            set {
                _bst = value;
                switch (value) {
                    case "SELL":
                        BST = BST.SELL;
                        break;
                    case "BUY":
                        BST = BST.BUY;
                        break;
                    case "TRADE":
                        BST = BST.TRADE;
                        break;
                    case "BST":
                        BST = BST.BST;
                        break;
                    default:
                        BST = BST.NONE;
                        break;
                }
                if (value == "SELL") {
                    BST = BST.SELL;
                }
            }
        }
        public BST BST { get; set; }

        public static Match FromPostedMatch(PostedMatchObject match) {
            Match m = new Match() {
                Companies = match.Companies,
                Currency = match.Currency ?? CurrencyMap.USD.Code,
                Price = match.Price,
                bst = match.BST,
            };
            return m;
        }

        public JObject ToJson() {
            JArray companyArr = new JArray();
            foreach(string comp in Companies) {
                companyArr.Add(comp);
            }

            Dictionary<string, JToken> keys = new Dictionary<string, JToken>() {
                {"companies", companyArr },
                {"currency", Currency },
                {"bst", _bst }
            };
            if(Price.HasValue) {
                keys.Add("price", Price.Value);
            }
            return JObject.FromObject(keys);
        }
    }
}
