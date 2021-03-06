import * as React from 'react';
import {
  GetBuySellTradeThreadData, ParseData
} from 'src/services/GetNewestData';
import './App.css';
import { GetCommonCompanies, GetCommonBoards } from 'src/services/GetCommonCompanies';
import { Company } from 'src/models/company';
import { IRedditData } from 'src/models/reddit';
import { Board } from 'src/models/board';
import { AugmentCompanies } from 'src/services/DispalyMappers';
import { IBSTThread, IBSTThreadComment, DefautThread } from 'src/models/IBST';
import { IBSTError } from 'src/models/BSTErrors';
import { BSTComment } from 'src/react/components/BSTComment/BSTComment';
import { BSTFooter } from 'src/react/components/BSTFooter/BSTFooter';
import { BSTHeader } from 'src/react/components/BSTHeader/BSTHeader';
import { SortFilter, DefaultSortFilter } from 'src/models/sortfilter';
import { FilterZone } from 'src/react/components/FilterZone/FIlterZone';
import { FindBuySellTradeThreads } from 'src/services/FindThread';
import { ParseQueryString, UpdateURL } from 'src/services/WindowServices';
import { SelectType } from 'src/models/selectTypes';
import { NotifyModal } from '../../components/NotifyModal/NotifyModal';

// Auto Fetch
let fetchTimerId: number | null;
function StartRefresh(Home: Home) {
  const f = async () => {
    console.log("Auto Fetching Thread");
    const threads: [Array<IBSTThread>, Array<IBSTError>] = await Load();
    if (threads[0].length === 0) {
      // Error
      Home.setState({ Threads: null, Companies: [], IsError: true, IsLoading: false, ErrorMessage: makeForError(threads[1][0]) });
      StopRefresh();
    } else {
      Home.UpdateLoadedThread(threads[0]);
    }
  }
  fetchTimerId = window.setInterval(f, 1000 * 60); // fetch once a minute
}

function StopRefresh() {
  console.log("Stopping Auto Thread Fetch");
  if (fetchTimerId !== null) {
    clearInterval(fetchTimerId);
    fetchTimerId = null;
  }
}

async function CommonCompanies() {
  let companies: Array<Company> = [];
  try {
    companies = await GetCommonCompanies();
  } catch (e) {
    console.log("An error ocurred while fetching common companies:");
    console.log(e);
  }
  return companies;
}

async function Load(): Promise<[Array<IBSTThread>, Array<IBSTError>]> {
  try {
    const companies: Array<Company> = await GetCommonCompanies();
    const forumstring: [Array<string>, Array<IBSTError>] = await FindBuySellTradeThreads();
    if (forumstring[0].length === 0) {
      return [[], forumstring[1]];
    }
    const boards: Array<Board> = await GetCommonBoards();
    // if (typeof (forumstring) !== typeof ("") {
    //   return [[DefautThread], forumstring[1]];
    // }

    const threads: Array<IBSTThread> = [];
    const errs: Array<IBSTError> = [];
    for (let i = 0; i < forumstring[0].length; i++) {
      const url = forumstring[0][i];
      console.log(url);
      const bstRaw: IRedditData | IBSTError = await GetBuySellTradeThreadData(url);
      if ("Code" in bstRaw) {
        console.log("Encountered an error");
        console.log(bstRaw);
        errs.push(bstRaw);
      } else {
        var y = ParseData(bstRaw, companies, boards);
        console.log(y);
        threads.push(y);
      }
    }
    return [threads, errs];
  } catch (e) {
    return [[DefautThread], []];
  }
}

function makeSortFilter(m: Map<string, string>, companies: Array<Company>): SortFilter {
  const sf: SortFilter = DefaultSortFilter;
  // Checking Order By
  if (m.has("order")) {
    const v: string = m.get("order")!;
    if (v === "up" || v === "down") {
      sf.Order = v;
    }
  }

  if (m.has("field")) {
    const v: string = m.get("field")!;
    if (
      v === "date_posted" || v === "price" ||
      v === "company" || v === "product" ||
      v === "reply_count" || v === "seller"
    ) {
      sf.Field = v;
    }
  }

  if (m.has("company")) {
    let v: string = m.get("company")!; //comma separated
    sf.Company = [];
    const compArr: string[] = [];
    const companySplits: string[] = v.split(',');
    if (companySplits.indexOf('any') !== -1) {
      sf.Company.push('any');
    } else {
      for (let i = 0; i < companySplits.length; i++) {
        let company: string = companySplits[i].toLocaleLowerCase();
        if (
          (company === "any" || company === "diy (amateur)" || company === "diy%20(amateur)")
          && !(company in compArr)) {
          compArr.push(company);
        }
        else {
          var mm = companies.map(x => x.company.toLocaleLowerCase());
          if (mm.indexOf(company) >= 0 && !(company in compArr)) {
            compArr.push(company);
          }
        }
      }
      sf.Company = compArr;
    }
  }
  if (m.has("bst")) {
    const v: string = m.get("bst")!;
    if (v === "bst" || v === "sell" || v === "buy" || v === "trade") {
      sf.BST = v;
    }
  }
  return sf;
}

function makeForError(err: IBSTError): string {
  let s: string = "";
  switch (err.Code) {
    case 403:
      // Network error - probably CORS
      s = "We tried to load data from reddit, but the request wasn't able to complete.<br/><br/> " +
        "If you are certain that your internet is working, then you may have Tracking Protection enabled.<br/><br/>" +
        "Some browsers consider cross-domain requests to be tracking, and disable it.<br/><br/>" +
        'Please see the <a class="inlineLink" href="/about">about</a> page for more details.'
      break;
    case 404:
      // file not found
      s = "Couldn't find the Buy Sell Trade thread for this month. Does one exist? If so, please keep it named something close to 'BUY/SELL/TRADE Monthly'<br/><br/>" +
        "If the title format of the thread has changed, please contact the developer on GitHub."
      break;
    default:
      s = "Some error ocurred and we weren't able to load the Buy Sell Trade thread. Sorry.";
      break;
  }
  return "<p>" + s + "</p>";
}

// let LoadedCompanies: Array<Company> = [];
let LoadedThreads: Array<IBSTThread> = [DefautThread];

interface AppState {
  OriginalThread: IBSTThread | null;
  Threads: Array<IBSTThread> | null;
  Companies: Array<Company>;
  IsError: boolean;
  IsLoading: boolean;
  ErrorMessage?: string;
  SortFilter: SortFilter;
  ModalIsOpen: boolean;
}

interface AppProps {
  location?: any; // Query string passed by React-Router
}

class Home extends React.Component<AppProps, AppState> {

  constructor(props: AppProps, state: AppState) {
    super(props, state);
    this.state = {
      Companies: [],
      Threads: [DefautThread],
      OriginalThread: DefautThread,
      IsLoading: true,
      IsError: false,
      SortFilter: DefaultSortFilter,
      ModalIsOpen: false,
    };
  }

  async componentDidMount() {
    try {
      const threads: [Array<IBSTThread>, Array<IBSTError>] = await Load();
      if (threads[0].length == 0) {
        // Error
        this.setState({ Threads: null, Companies: [], IsError: true, IsLoading: false, ErrorMessage: makeForError(threads[1][0]) });
        StopRefresh();
      } else {
        const companies: Array<Company> = AugmentCompanies(await CommonCompanies());
        StartRefresh(this);
        LoadedThreads = [];
        threads[0].forEach(x => {
          LoadedThreads.push({
            ...x,
          });
        })
        const sf: SortFilter = makeSortFilter(ParseQueryString(this.props.location.search), companies)
        this.setState({ Threads: this.filter(sf), Companies: companies, IsLoading: false, IsError: false }); // TODO testing IsLoading
      }
    } catch (e) {
      this.setState({ Threads: null, Companies: [], IsError: true, IsLoading: false, ErrorMessage: "Something happened" + e });
      StopRefresh();
    }
  }

  componentWillUnmount() {
    StopRefresh();
  }

  public UpdateLoadedThread(t: Array<IBSTThread>): void {
    if (t === LoadedThreads) {
      return;
    }
    LoadedThreads = t;
    this.setState({ Threads: this.filter(this.state.SortFilter), IsLoading: false, IsError: false });
  }


  private filter(sortFilter: SortFilter): Array<IBSTThread> {
    let threads: Array<IBSTThread> = [];


    function filter(value: IBSTThreadComment): boolean {
      // checking company
      // console.log(sortFilter);
      if ((sortFilter.Company.indexOf("any") == -1)) {
        const tc: string = value.Company.toLocaleLowerCase();
        if (
          sortFilter.Company.indexOf(tc) == -1
          // || (sortFilter.Company.indexOf("other / unknown") != -1 && value.Company !== '?')
        ) {
          return false;
        }
        // else if(sortFilter.Company.indexOf("other / unknown") != -1) {
        //   if(value.Company !== "?") {
        //     // Item failed match the unknown/orginal special category
        //     return false;
        //   }
        // }  
      }

      // checking BST
      const vbst: string = value.BST.toLocaleLowerCase();
      if (sortFilter.BST === "buy" && vbst !== "buy") {
        return false;
      }
      if (sortFilter.BST === "sell" && vbst !== "sell") {
        return false;
      }
      if (sortFilter.BST === "trade" && vbst !== "trade") {
        return false;
      }
      if (sortFilter.BST === "bst" && (vbst !== "buy" && vbst !== "trade" && vbst !== "sell")) {
        return false;
      }
      return true;
    }

    function sort(a: IBSTThreadComment, b: IBSTThreadComment): number {

      let first: IBSTThreadComment = a;
      let second: IBSTThreadComment = b;
      if (sortFilter.Order === "down") {
        first = b;
        second = a;
      }

      function sortDatePosted(): number {
        return Number(first.DatePosted) - Number(second.DatePosted);
      }

      function sortPrice(): number {
        return first.Price - second.Price;
      }

      function sortCompany(): number {
        const fname: string = first.Company === "?" ? "" : first.Company.toLocaleLowerCase();
        const sname: string = second.Company === "?" ? "" : second.Company.toLocaleLowerCase();
        if (fname < sname) {
          return -1;
        } else if (fname > sname) {
          return 1;
        } else {
          return 0;
        }
      }

      function sortProduct(): number {
        const fname: string = first.Product === "?" ? "" : first.Product.toLocaleLowerCase();
        const sname: string = second.Product === "?" ? "" : second.Product.toLocaleLowerCase();
        if (fname < sname) {
          return -1;
        } else if (fname > sname) {
          return 1;
        } else {
          return 0;
        }
      }

      function sortReplyCount(): number {
        return first.NumberOfReplies - second.NumberOfReplies;
      }

      function sortSeller(): number {
        const fname: string = first.Seller.toLocaleLowerCase();
        const sname: string = second.Seller.toLocaleLowerCase();
        if (fname < sname) {
          return -1;
        } else if (fname > sname) {
          return 1;
        } else {
          return 0;
        }
      }

      if (sortFilter.Field === "date_posted") {
        return sortDatePosted();
      } else if (sortFilter.Field === "price") {
        return sortPrice();
      } else if (sortFilter.Field === "reply_count") {
        return sortReplyCount();
      } else if (sortFilter.Field === "company") {
        return sortCompany();
      } else if (sortFilter.Field === "seller") {
        return sortSeller();
      } else if (sortFilter.Field === "product") {
        return sortProduct();
      }
      else {
        return 0;
      }
    }

    LoadedThreads.forEach(x => {
      let newThread: IBSTThread = {
        Metadata: x.Metadata,
        BSTs: x.BSTs.filter(val => filter(val)).sort(sort),
      };
      threads.push(newThread);
    });

    return threads;

  }
  private FilterChanged(sortFilter: SortFilter) {
    this.setState({ Threads: this.filter(sortFilter), SortFilter: sortFilter });
  }

  private OnCompanyChange(val: SelectType[]) {
    console.log(val);
    const newCompanies: string[] = [];
    // Add all new filters
    for (let i = 0; i < val.length; i++) {
      const st: SelectType = val[i];
      const value = st.value.toLocaleLowerCase();
      newCompanies.push(value);
    }
    // Remove the 'any' filter, which doesnt make sense in multi-filter.
    if (newCompanies.length > 1 && newCompanies.indexOf('any') !== -1) {
      const anyidx: number = newCompanies.indexOf('any');
      newCompanies.splice(anyidx, 1);
    }
    // Unless there are no other filters, in which case it is implicitly any.
    if (newCompanies.length == 0) {
      newCompanies.push('any');
    }
    if (this.state.Threads && this.state.OriginalThread) {
      const newSortFilter: SortFilter = {
        ...this.state.SortFilter,
        Company: newCompanies,
      };

      if (newCompanies.indexOf('any') !== -1) {
        UpdateURL("company", null);
      } else {
        UpdateURL("company", newCompanies);
      }
      this.FilterChanged(newSortFilter);
    }
  }

  private OnOrderByChange(val: string) {
    val = val.toLocaleLowerCase();
    if (this.state.Threads && this.state.OriginalThread) {
      const newSortFilter: SortFilter = {
        ...this.state.SortFilter,
        Order: val,
      };
      UpdateURL("order", [val]);
      this.FilterChanged(newSortFilter);
    }
  }

  private OnSortByFieldChange(val: string) {
    val = val.toLocaleLowerCase();
    if (this.state.Threads && this.state.OriginalThread) {
      const newSortFilter: SortFilter = {
        ...this.state.SortFilter,
        Field: val,
      };
      UpdateURL("field", [val]);
      this.FilterChanged(newSortFilter);
    }
  }

  private OnBSTChange(val: string) {
    val = val.toLocaleLowerCase();
    if (this.state.Threads && this.state.OriginalThread) {
      const newSortFilter: SortFilter = {
        ...this.state.SortFilter,
        BST: val,
      };
      UpdateURL("bst", [val]);
      this.FilterChanged(newSortFilter);
    }
  }

  private ResetFilters() {
    const newSortFilter: SortFilter = {
      BST: "bst",
      Company: ["any"],
      Field: "date_posted",
      Order: "down"
    };
    UpdateURL(null, null);
    this.FilterChanged(newSortFilter);
  }

  private OnNotifyOpen() {
    this.setState({ ModalIsOpen: true });
  }
  private OnNotifyClose() {
    this.setState({ ModalIsOpen: false });
  }

  public render() {

    const OnCompanyChange = this.OnCompanyChange.bind(this);
    const OnOrderByChange = this.OnOrderByChange.bind(this);
    const OnSortByFieldChange = this.OnSortByFieldChange.bind(this);
    const OnBSTChange = this.OnBSTChange.bind(this);
    const ResetFilters = this.ResetFilters.bind(this);
    const OnNotifyOpen = this.OnNotifyOpen.bind(this);
    const OnNotifyClose = this.OnNotifyClose.bind(this);

    function renderLoading() {
      return (
        <div className="App App-body">
          <BSTHeader />
          <FilterZone
            OnCompanyChange={OnCompanyChange}
            OnOrderByChange={OnOrderByChange}
            OnSortByFieldChange={OnSortByFieldChange}
            OnBSTChange={OnBSTChange}
            LoadedThreads={LoadedThreads}
            Sorter={DefaultSortFilter}
            Companies={[]}
            ResetFilters={ResetFilters}
            OnNotifyOpen={() => { }}
          />

          <div className="BSTZone">
            ...
          </div>

          <BSTFooter />

        </div>
      );
    }

    function renderError(err: string) {
      return (
        <div className="App App-body">
          <BSTHeader error={true} />
          <FilterZone
            OnCompanyChange={OnCompanyChange}
            OnOrderByChange={OnOrderByChange}
            OnSortByFieldChange={OnSortByFieldChange}
            OnBSTChange={OnBSTChange}
            LoadedThreads={LoadedThreads}
            Sorter={DefaultSortFilter}
            Companies={[]}
            ResetFilters={ResetFilters}
            OnNotifyOpen={() => { }}
          />

          <div className="BSTZone" dangerouslySetInnerHTML={{ __html: err }}>
          </div>

          <BSTFooter />

        </div>
      );
    }

    function renderOk(state: AppState) {
      return (
        <div className="App App-body">

          <BSTHeader threads={state.Threads!} />

          <FilterZone
            OnCompanyChange={OnCompanyChange}
            OnOrderByChange={OnOrderByChange}
            OnSortByFieldChange={OnSortByFieldChange}
            OnBSTChange={OnBSTChange}
            LoadedThreads={LoadedThreads}
            Threads={state.Threads!}
            Sorter={state.SortFilter}
            Companies={state.Companies}
            ResetFilters={ResetFilters}
            OnNotifyOpen={OnNotifyOpen}
          />

          <NotifyModal IsOpen={state.ModalIsOpen} OnAfterOpen={() => { }} OnCloseModal={OnNotifyClose} Companies={state.Companies} />

          <div className="BSTZone">
            {
              state.Threads!.map(x => {
                return x.BSTs.map((v: IBSTThreadComment) => {
                  const idkey: string = "bstComment_" + v.Seller + "_" + Number(v.DatePosted);
                  return (
                    <BSTComment key={idkey} comment={v} />
                  );
                })
              })
            }
          </div>

          <BSTFooter />
        </div>
      );
    }

    if (this.state.IsLoading) {
      return renderLoading();
    } else if (this.state.IsError) {
      StopRefresh();
      return renderError(this.state.ErrorMessage!);
    } else {
      return renderOk(this.state);
    }
  }
}
export { Home }
