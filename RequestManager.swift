//
//  RequestManager.swift
//
//  Created by Manish on 20/04/24.
//
import Foundation

class RequestManager<T: Codable> {
    private lazy var sharedInstance: RequestManager<T> = {
        let instance = RequestManager<T>()
        return instance
    }()
    
    var shared: RequestManager<T> {
        return sharedInstance
    }
    // MARK: GET CAll
    func get(url: URL, headers: [String: String]?, completion: @escaping (Result<T, Error>) -> Void) {
        // Create a request
        var request = URLRequest(url: url)
        
        // Define the request method
        request.httpMethod = "GET"
        
        // Define the headers for the request
        request.allHTTPHeaderFields = headers
        
        // URLSession task
        let task = URLSession.shared.dataTask(with: request) { (data, response, error) in
            if let error = error {
                completion(.failure(error))
                return
            }
            
            guard let data = data else {
                completion(.failure(NSError(domain: "", code: -1, userInfo: [NSLocalizedDescriptionKey: "Data not found"])))
                return
            }
            
            do {
                //                if let responseString = String(data: data, encoding: .utf8) {
                //                    print("GET data:", responseString)
                //                }
                let decoder = JSONDecoder()
                let response = try decoder.decode(T.self, from: data)
                completion(.success(response))
            } catch let error {
                completion(.failure(error))
            }
        }
        task.resume()
        
    }
    
    // MARK: POST CALL
    func post(url: URL, headers: [String : String]? , body: [String : Any]?, completion: @escaping (Result<T, Error>) -> Void) {
        
        // create URL Request
        var request = URLRequest(url: url)
        
        // Define the call method
        request.httpMethod = "POST"
        
        // Set the Headers
        request.allHTTPHeaderFields = headers
        
        // Handle the body
        do {
            let jsonData = try JSONSerialization.data(withJSONObject: body, options: [])
            request.httpBody = jsonData
        } catch let error {
            completion(.failure(error))
            return
        }
        
        // URLSession Task
        let task = URLSession.shared.dataTask(with: request) { (data, response, error) in
            if let error = error {
                completion(.failure(error))
                return
            }
            
            guard let data = data else {
                completion(.failure(NSError(domain: "", code: -1, userInfo: [NSLocalizedDescriptionKey: "Data not found"])))
                return
            }
            
            do {
                //                if let responseString = String(data: data, encoding: .utf8) {
                //                    print("POST data:", responseString)
                //                }
                let decoder = JSONDecoder()
                let response = try decoder.decode(T.self, from: data)
                completion(.success(response))
            } catch let error {
                completion(.failure(error))
            }
        }
        task.resume()
    }
    
    // MARK: PUT CALL
    
    func put(url: URL, headers: [String : String]? , body: [String : Any]?, completion: @escaping (Result<T, Error>) -> Void) {
        
        // create URL Request
        var request = URLRequest(url: url)
        
        // Define the call method
        request.httpMethod = "PUT"
        
        // Set the Headers
        request.allHTTPHeaderFields = headers
        
        // Handle the body
        do {
            let jsonData = try JSONSerialization.data(withJSONObject: body, options: [])
            request.httpBody = jsonData
        } catch let error {
            completion(.failure(error))
            return
        }
        
        // URLSession Task
        let task = URLSession.shared.dataTask(with: request) { (data, response, error) in
            if let error = error {
                completion(.failure(error))
                return
            }
            
            guard let data = data else {
                completion(.failure(NSError(domain: "", code: -1, userInfo: [NSLocalizedDescriptionKey: "Data not found"])))
                return
            }
            
            do {
                if let responseString = String(data: data, encoding: .utf8) {
                    print("\(url) PUT data:", responseString)
                }
                let decoder = JSONDecoder()
                let response = try decoder.decode(T.self, from: data)
                completion(.success(response))
            } catch let error {
                completion(.failure(error))
            }
        }
        task.resume()
    }
    
    
    // MARK: POST CALL WITH BODY AS String
    func postWithStringBody(url: URL, headers: [String : String]? , body: String, completion: @escaping (Result<T, Error>) -> Void) {
        
        // create URL Request
        var request = URLRequest(url: url)
        
        // Define the call method
        request.httpMethod = "POST"
        
        // Set the Headers
        request.allHTTPHeaderFields = headers
        
        // Handle the body
        request.httpBody = body.data(using: .utf8)
        
        // URLSession Task
        let task = URLSession.shared.dataTask(with: request) { (data, response, error) in
            if let error = error {
                completion(.failure(error))
                return
            }
            
            guard let data = data else {
                completion(.failure(NSError(domain: "", code: -1, userInfo: [NSLocalizedDescriptionKey: "Data not found"])))
                return
            }
            
            do {
                let decoder = JSONDecoder()
                let response = try decoder.decode(T.self, from: data)
                completion(.success(response))
            } catch let error {
                completion(.failure(error))
            }
        }
        task.resume()
    }
    
    
    // MARK: Create Journal POST call
    func createJournal(noteId: Int? , journalEntryCopy: [String: Any] ) async -> [String: Any]{
        let params: [String: Any] = [
            "note": noteId ?? "",
            "content": journalEntryCopy,
            "is_done": true
        ]
        
        let url = URL(string: "usernotes/")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer ", forHTTPHeaderField: "Authorization")
        
        do {
            let jsonData = try JSONSerialization.data(withJSONObject: params)
            request.httpBody = jsonData
            let (data, _) = try await URLSession.shared.data(for: request)
            let newFormat = try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
            // Handle response...
            return newFormat
        } catch {
            // Handle error...
            return ["error": error]
        }
    }
    
}


